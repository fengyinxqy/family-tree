/** 完整性校验错误码与中文释义 */
export const INTEGRITY_ERRORS = {
  /** 自关联：配偶或亲子关系中两端是同一人 */
  self_relationship: {
    code: "self_relationship" as const,
    message: "不能建立自身到自身的关系",
  },
  /** 重复关系：同名同向关系已存在 */
  duplicate_relationship: {
    code: "duplicate_relationship" as const,
    message: "该关系已存在",
  },
  /** 端点无效：一端或两端不在当前活跃家谱中 */
  invalid_endpoint: {
    code: "invalid_endpoint" as const,
    message: "关系端点不存在或已被删除",
  },
  /** 祖先循环：亲子边将形成闭环 */
  ancestry_cycle: {
    code: "ancestry_cycle" as const,
    message: "此关系会形成祖先循环",
  },
  /** 世代冲突：候选关系与现有世代约束矛盾 */
  generation_conflict: {
    code: "generation_conflict" as const,
    message: "此关系与现有世代信息矛盾",
  },
} as const;

export type IntegrityErrorCode = keyof typeof INTEGRITY_ERRORS;

/** 校验结果 */
export interface IntegrityResult {
  valid: boolean;
  error?: {
    code: IntegrityErrorCode;
    message: string;
    /** 涉及的实体ID */
    entityIds: string[];
    /** 冲突路径（祖先后代校验时提供） */
    conflictPath?: string[];
  };
}

/** 关系候选（用于校验） */
export interface RelationshipCandidate {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
}

/** 活跃图中的关系（已存在） */
export interface ExistingRelationship {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
}

/** 活跃图中的人物（已存在） */
export interface ExistingPerson {
  id: string;
  name: string;
  generationNumber: number;
}

interface GraphInput {
  activePersonIds: Set<string>;
  activeRelationships: ExistingRelationship[];
}

function makeError(code: IntegrityErrorCode, entityIds: string[], conflictPath?: string[]): IntegrityResult {
  return {
    valid: false,
    error: {
      code,
      message: INTEGRITY_ERRORS[code].message,
      entityIds,
      conflictPath,
    },
  };
}

const OK: IntegrityResult = { valid: true };

/**
 * 校验候选关系的端点有效性
 */
function validateEndpoints(
  candidate: RelationshipCandidate,
  graph: GraphInput,
): IntegrityResult {
  if (!graph.activePersonIds.has(candidate.personAId)) {
    return makeError("invalid_endpoint", [candidate.personAId]);
  }
  if (!graph.activePersonIds.has(candidate.personBId)) {
    return makeError("invalid_endpoint", [candidate.personBId]);
  }
  return OK;
}

/**
 * 校验自关联
 */
function validateSelfReference(candidate: RelationshipCandidate): IntegrityResult {
  if (candidate.personAId === candidate.personBId) {
    return makeError("self_relationship", [candidate.personAId]);
  }
  return OK;
}

/**
 * 校验重复关系
 * 配偶：双向去重（A-B 和 B-A 视为同一配偶关系）
 * 亲子：单向去重
 */
function validateDuplicate(
  candidate: RelationshipCandidate,
  graph: GraphInput,
): IntegrityResult {
  for (const rel of graph.activeRelationships) {
    if (rel.type === "spouse" && candidate.type === "spouse") {
      const match =
        (rel.personAId === candidate.personAId && rel.personBId === candidate.personBId) ||
        (rel.personAId === candidate.personBId && rel.personBId === candidate.personAId);
      if (match) {
        return makeError("duplicate_relationship", [candidate.personAId, candidate.personBId]);
      }
    }
    if (rel.type === "child" && candidate.type === "child") {
      if (rel.personAId === candidate.personAId && rel.personBId === candidate.personBId) {
        return makeError("duplicate_relationship", [candidate.personAId, candidate.personBId]);
      }
    }
  }
  return OK;
}

/**
 * 检测祖先循环
 * 使用DFS从personB（子女）沿父边向上遍历，检查是否可达personA（父母）
 */
function validateAncestryCycle(
  candidate: RelationshipCandidate,
  graph: GraphInput,
): IntegrityResult {
  if (candidate.type !== "child") return OK;

  // 构建父→子邻接表（仅使用已有关系，不包含候选边）
  // 核心问题：A→B 会形成环吗？即：在已有图中，B能否通过父→子边到达A？
  // 如果能，说明A已是B的后代，再添加A→B会使A成为自己祖先的祖先→环
  const children = new Map<string, string[]>();
  for (const rel of graph.activeRelationships) {
    if (rel.type !== "child") continue;
    if (!children.has(rel.personAId)) children.set(rel.personAId, []);
    children.get(rel.personAId)!.push(rel.personBId);
  }

  // 从B向下遍历（父→子方向），检查是否能到达A
  const visited = new Set<string>();
  const stack = [candidate.personBId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === candidate.personAId) {
      return makeError("ancestry_cycle", [candidate.personAId, candidate.personBId], [...visited, current]);
    }
    if (visited.has(current)) continue;
    visited.add(current);

    // 向下遍历：跟随父→子边
    for (const childId of children.get(current) ?? []) {
      if (!visited.has(childId)) {
        stack.push(childId);
      }
    }
  }

  return OK;
}

/**
 * 构建世代关系图：计算任意两人之间的世代差
 * spouse边差0代，child边(A→B)表示B比A多1代
 */
function buildGenerationMap(
  relationships: ExistingRelationship[],
  candidate?: RelationshipCandidate,
): Map<string, Map<string, number>> {
  const dist = new Map<string, Map<string, number>>();

  function addEdge(a: string, b: string, diff: number) {
    if (!dist.has(a)) dist.set(a, new Map());
    dist.get(a)!.set(b, diff);
    if (!dist.has(b)) dist.set(b, new Map());
    dist.get(b)!.set(a, -diff);
  }

  for (const rel of relationships) {
    if (rel.type === "spouse") {
      addEdge(rel.personAId, rel.personBId, 0);
    } else if (rel.type === "child") {
      addEdge(rel.personAId, rel.personBId, 1);
    }
  }

  if (candidate) {
    if (candidate.type === "spouse") {
      addEdge(candidate.personAId, candidate.personBId, 0);
    } else {
      addEdge(candidate.personAId, candidate.personBId, 1);
    }
  }

  // Floyd-Warshall计算所有对世代差
  const nodes = [...dist.keys()];
  for (const k of nodes) {
    for (const i of nodes) {
      for (const j of nodes) {
        const ik = dist.get(i)?.get(k);
        const kj = dist.get(k)?.get(j);
        if (ik !== undefined && kj !== undefined) {
          const current = dist.get(i)?.get(j);
          const newDist = ik + kj;
          if (current === undefined || newDist !== current) {
            if (!dist.has(i)) dist.set(i, new Map());
            dist.get(i)!.set(j, newDist);
          }
        }
      }
    }
  }

  return dist;
}

/**
 * 世代约束校验
 * 如果已有路径暗示两人在同一代（差0），则不能建立亲子关系（差±1）
 */
function validateGeneration(
  candidate: RelationshipCandidate,
  graph: GraphInput,
): IntegrityResult {
  const generationMap = buildGenerationMap(graph.activeRelationships);

  // 检查候选两端之间是否已有世代差约束
  const existingDiff = generationMap.get(candidate.personAId)?.get(candidate.personBId);

  if (existingDiff !== undefined) {
    let candidateDiff: number;
    if (candidate.type === "spouse") {
      candidateDiff = 0;
    } else {
      // child: personA是父母，personB是子女 → B比A多1代
      candidateDiff = 1;
    }

    if (existingDiff !== candidateDiff) {
      // 带候选边重新计算看是否一致
      const withCandidate = buildGenerationMap(graph.activeRelationships, candidate);
      // 检查一致性：所有节点对的世代差是否自洽
      for (const [i, row] of withCandidate) {
        for (const [j, diff] of row) {
          // 检查同一条路径是否有不同世代差
          const reverse = withCandidate.get(j)?.get(i);
          if (reverse !== undefined && reverse !== -diff) {
            return makeError("generation_conflict", [candidate.personAId, candidate.personBId]);
          }
        }
      }
    }
  }

  return OK;
}

/**
 * 校验单个候选关系
 */
export function validateRelationshipCandidate(
  candidate: RelationshipCandidate,
  activePersonIds: Set<string>,
  activeRelationships: ExistingRelationship[],
): IntegrityResult {
  const graph: GraphInput = { activePersonIds, activeRelationships };

  // 按序执行各项校验
  let result: IntegrityResult;

  result = validateEndpoints(candidate, graph);
  if (!result.valid) return result;

  result = validateSelfReference(candidate);
  if (!result.valid) return result;

  result = validateDuplicate(candidate, graph);
  if (!result.valid) return result;

  result = validateAncestryCycle(candidate, graph);
  if (!result.valid) return result;

  result = validateGeneration(candidate, graph);
  if (!result.valid) return result;

  return OK;
}

/**
 * 批量校验一组候选关系
 */
export function validateRelationshipBatch(
  candidates: RelationshipCandidate[],
  activePersonIds: Set<string>,
  activeRelationships: ExistingRelationship[],
): Map<number, IntegrityResult> {
  const results = new Map<number, IntegrityResult>();

  // 模拟逐个添加来检测批量内的冲突
  const simulatedRelationships = [...activeRelationships];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const simulatedPersonIds = new Set(activePersonIds);
    simulatedPersonIds.add(candidate.personAId);
    simulatedPersonIds.add(candidate.personBId);

    // 检测与已存在+前面候选的关系
    const result = validateRelationshipCandidate(
      candidate,
      simulatedPersonIds,
      simulatedRelationships,
      // 注：这里实际上不会检查与前面候选的重复
    );

    if (!result.valid) {
      results.set(i, result);
    } else {
      simulatedRelationships.push(candidate);
    }
  }

  return results;
}
/**
 * 家谱亲属关系推理引擎
 *
 * ## 设计原则
 *
 * 1. **确定性引擎**：亲属关系完全由 BFS 最短路 + hop pattern 匹配决定，不依赖 LLM。
 * 2. **基于 spous/child 推导**：所有中文亲属称谓均从 spouse 与 child 两种原始关系推导。
 * 3. **聚合称谓策略**：因当前数据模型缺少年龄排序、排行字段，对伯/叔、哥/弟、姐/妹
 *    等需要长幼信息的称谓采用聚合表述（如 "伯叔辈长辈"、"兄弟姐妹"），避免伪精确。
 * 4. **父系/母系区分**：当连接父/母的性别已知时，区分伯叔/姑（父系）与舅/姨（母系）；
 *    否则使用跨系聚合称谓。
 *
 * ## 中文称谓覆盖边界
 *
 * ### 精确命名层（已覆盖的 hop pattern）
 * - spouse, parent, child, parent>child, parent>parent, child>child, child>parent
 * - parent>child>child（侄甥辈，按分支性别区分 侄/外甥）
 * - parent>parent>child（伯叔/姑/舅/姨，按连接父/母性别与目标性别区分）
 * - parent>parent>child>child（堂表亲）
 * - parent>child>spouse（兄弟姐妹的配偶）
 * - spouse>parent>child（配偶的兄弟姐妹）
 * - spouse>parent, spouse>child, parent>spouse（姻亲直系）
 *
 * ### 半精确层（已识别亲属层级但无法精确命名）
 * - 纯血亲路径按 parent/child 跳数差分为：上辈/下辈/同辈旁系亲属
 * - 含配偶路径按跳数和配偶位置分为：姻亲长辈/晚辈/同辈
 * - 多重配偶路径：复杂姻亲关系
 *
 * ### 已知限制
 * - 不区分堂/表（父系堂亲 vs 母系表亲）：需要知道祖辈的性别谱系与地域宗族信息
 * - 不区分长幼（伯 vs 叔、兄 vs 弟）：需要出生日期或排行信息
 * - 姻亲称谓较粗（用 "配偶的兄弟姐妹" 而非 "大舅子/小姨子" 等口语化称谓）
 * - 最大推理深度为 5 hop
 */
import type { Person, Relationship } from "@prisma/client";
import type {
  RelationshipInference,
  RelationshipPathHop,
} from "@/lib/agent/types";

interface GraphEdge {
  to: string;
  kind: "spouse" | "parent" | "child";
}

function buildGraph(relationships: Relationship[]) {
  const graph = new Map<string, GraphEdge[]>();

  const addEdge = (from: string, to: string, kind: GraphEdge["kind"]) => {
    const edges = graph.get(from) || [];
    edges.push({ to, kind });
    graph.set(from, edges);
  };

  for (const relationship of relationships) {
    if (relationship.type === "spouse") {
      addEdge(relationship.personAId, relationship.personBId, "spouse");
      addEdge(relationship.personBId, relationship.personAId, "spouse");
      continue;
    }

    addEdge(relationship.personAId, relationship.personBId, "child");
    addEdge(relationship.personBId, relationship.personAId, "parent");
  }

  return graph;
}

function findShortestPath(
  sourceId: string,
  targetId: string,
  graph: Map<string, GraphEdge[]>,
  maxDepth = 5,
): RelationshipPathHop[] {
  if (sourceId === targetId) {
    return [];
  }

  const queue: Array<{ personId: string; path: RelationshipPathHop[] }> = [
    { personId: sourceId, path: [] },
  ];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.path.length >= maxDepth) {
      continue;
    }

    const neighbors = graph.get(current.personId) || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.to)) {
        continue;
      }

      const nextPath = current.path.concat({
        fromPersonId: current.personId,
        toPersonId: neighbor.to,
        kind: neighbor.kind,
      });

      if (neighbor.to === targetId) {
        return nextPath;
      }

      visited.add(neighbor.to);
      queue.push({ personId: neighbor.to, path: nextPath });
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// 中文称谓辅助函数
// ---------------------------------------------------------------------------

function byTargetGender(
  targetGender: string | undefined,
  options: { male: string; female: string; unknown: string },
) {
  if (targetGender === "male") return options.male;
  if (targetGender === "female") return options.female;
  return options.unknown;
}

/** 直系：父亲 / 母亲 / 父母 */
function directParentLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "父亲",
    female: "母亲",
    unknown: "父母",
  });
}

/** 直系：儿子 / 女儿 / 子女 */
function directChildLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "儿子",
    female: "女儿",
    unknown: "子女",
  });
}

/** 同辈直系：兄弟 / 姐妹 / 兄弟姐妹 */
function siblingLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "兄弟",
    female: "姐妹",
    unknown: "兄弟姐妹",
  });
}

/** 上两代：祖父 / 祖母 / 祖辈 */
function grandparentLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "祖父",
    female: "祖母",
    unknown: "祖辈",
  });
}

/** 下两代：孙子 / 孙女 / 孙辈 */
function grandchildLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "孙子",
    female: "孙女",
    unknown: "孙辈",
  });
}

/**
 * 父母辈旁系长辈称谓。
 *
 * 根据目标人物性别和连接父/母的性别区分：
 * - parentGender = "male"（父方）：伯叔辈长辈 / 姑辈长辈
 * - parentGender = "female"（母方）：舅辈长辈 / 姨辈长辈
 * - parentGender 未知：伯叔舅辈长辈 / 姑姨辈长辈（跨系聚合）
 */
function auntOrUncleLabel(
  targetGender: string | undefined,
  parentGender?: string | undefined,
) {
  if (parentGender === "male") {
    return byTargetGender(targetGender, {
      male: "伯叔辈长辈",
      female: "姑辈长辈",
      unknown: "父亲的兄弟姐妹辈长辈",
    });
  }

  if (parentGender === "female") {
    return byTargetGender(targetGender, {
      male: "舅辈长辈",
      female: "姨辈长辈",
      unknown: "母亲的兄弟姐妹辈长辈",
    });
  }

  // 无法区分父系/母系时，使用跨系聚合称谓
  return byTargetGender(targetGender, {
    male: "伯叔舅辈长辈",
    female: "姑姨辈长辈",
    unknown: "父母的兄弟姐妹辈长辈",
  });
}

/**
 * 侄甥辈晚辈称谓。
 *
 * 根据分支人物（父母一代的兄弟姐妹）性别区分：
 * - 分支为男（兄弟的子女）→ 侄子 / 侄女
 * - 分支为女（姐妹的子女）→ 外甥 / 外甥女
 * - 分支性别未知 → 侄甥聚合
 */
function nephewOrNieceLabel(
  branchPersonGender: string | undefined,
  targetGender: string | undefined,
) {
  if (branchPersonGender === "male") {
    return byTargetGender(targetGender, {
      male: "侄子",
      female: "侄女",
      unknown: "侄辈晚辈",
    });
  }

  if (branchPersonGender === "female") {
    return byTargetGender(targetGender, {
      male: "外甥",
      female: "外甥女",
      unknown: "甥辈晚辈",
    });
  }

  return byTargetGender(targetGender, {
    male: "侄甥辈男晚辈",
    female: "侄甥辈女晚辈",
    unknown: "侄甥辈晚辈",
  });
}

/** 堂表亲称谓 */
function cousinLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "堂表兄弟",
    female: "堂表姐妹",
    unknown: "堂表亲",
  });
}

/**
 * 兄弟姐妹的配偶标签（聚合称谓，不区分长幼）。
 *
 * - 兄弟的配偶 → 兄弟的配偶（聚合 嫂/弟媳）
 * - 姐妹的配偶 → 姐妹的配偶（聚合 姐夫/妹夫）
 */
function siblingSpouseLabel(
  siblingGender: string | undefined,
  targetGender: string | undefined,
) {
  if (siblingGender === "male") {
    return byTargetGender(targetGender, {
      male: "兄弟的配偶",
      female: "兄弟的配偶",
      unknown: "兄弟的配偶",
    });
  }

  if (siblingGender === "female") {
    return byTargetGender(targetGender, {
      male: "姐妹的配偶",
      female: "姐妹的配偶",
      unknown: "姐妹的配偶",
    });
  }

  return "兄弟姐妹的配偶";
}

/**
 * 配偶的兄弟姐妹标签（聚合称谓）。
 */
function spouseSiblingLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "配偶的兄弟",
    female: "配偶的姐妹",
    unknown: "配偶的兄弟姐妹",
  });
}

// ---------------------------------------------------------------------------
// 兜底体系（三层）
// ---------------------------------------------------------------------------

interface HopProfile {
  /** 向上（parent）跳数 */
  up: number;
  /** 向下（child）跳数 */
  down: number;
  /** 配偶跳数 */
  spouse: number;
  /** 是否有配偶跳注入了姻亲成分 */
  isAffine: boolean;
}

function classifyHops(path: RelationshipPathHop[]): HopProfile {
  let up = 0;
  let down = 0;
  let spouse = 0;

  for (const hop of path) {
    if (hop.kind === "parent") up++;
    else if (hop.kind === "child") down++;
    else if (hop.kind === "spouse") spouse++;
  }

  return {
    up,
    down,
    spouse,
    isAffine: spouse > 0,
  };
}

/**
 * 半精确层兜底：按亲属层级输出分层描述。
 *
 * 适用场景：找到了路径，但 hop pattern 没有精确命名映射，或信息不足以细分。
 */
function semiPreciseFallback(
  profile: HopProfile,
  targetGender: string | undefined,
): { relationship: string; inverseRelationship: string } {
  const { up, down, isAffine } = profile;
  const diff = up - down;

  // 纯姻亲路径
  if (isAffine && up === 0 && down === 0) {
    return {
      relationship: "姻亲亲属",
      inverseRelationship: "姻亲亲属",
    };
  }

  if (isAffine) {
    if (diff > 0) {
      return {
        relationship: "姻亲长辈",
        inverseRelationship: "晚辈姻亲",
      };
    }
    if (diff < 0) {
      return {
        relationship: "姻亲晚辈",
        inverseRelationship: "长辈姻亲",
      };
    }
    return {
      relationship: "姻亲同辈",
      inverseRelationship: "姻亲同辈",
    };
  }

  // 纯血亲路径
  if (diff > 0) {
    if (diff === 1) {
      return {
        relationship: byTargetGender(targetGender, {
          male: "上辈旁系男性亲属",
          female: "上辈旁系女性亲属",
          unknown: "上辈旁系亲属",
        }),
        inverseRelationship: "下辈旁系亲属",
      };
    }
    return {
      relationship: byTargetGender(targetGender, {
        male: "上两辈旁系男性亲属",
        female: "上两辈旁系女性亲属",
        unknown: "上两辈旁系亲属",
      }),
      inverseRelationship: "下两辈旁系亲属",
    };
  }

  if (diff < 0) {
    if (diff === -1) {
      return {
        relationship: byTargetGender(targetGender, {
          male: "下辈旁系男性亲属",
          female: "下辈旁系女性亲属",
          unknown: "下辈旁系亲属",
        }),
        inverseRelationship: "上辈旁系亲属",
      };
    }
    return {
      relationship: byTargetGender(targetGender, {
        male: "下两辈旁系男性亲属",
        female: "下两辈旁系女性亲属",
        unknown: "下两辈旁系亲属",
      }),
      inverseRelationship: "上两辈旁系亲属",
    };
  }

  // diff === 0: 同辈
  return {
    relationship: byTargetGender(targetGender, {
      male: "同辈旁系男性亲属",
      female: "同辈旁系女性亲属",
      unknown: "同辈旁系亲属",
    }),
    inverseRelationship: "同辈旁系亲属",
  };
}


// ---------------------------------------------------------------------------
// 路径字符串化
// ---------------------------------------------------------------------------

function formatHopLabels(path: RelationshipPathHop[]) {
  return path
    .map((hop) => {
      if (hop.kind === "spouse") return "配偶";
      if (hop.kind === "parent") return "父母";
      return "子女";
    })
    .join(" -> ");
}

// ---------------------------------------------------------------------------
// 路径模式 → 中文称谓 + 解释 核心映射
// ---------------------------------------------------------------------------

/**
 * 快捷结果构造器 */
function makeResult(
  relationship: string,
  inverseRelationship: string,
  explanation: string,
): Pick<
  RelationshipInference,
  "relationship" | "inverseRelationship" | "explanation"
> {
  return { relationship, inverseRelationship, explanation };
}

/**
 * 根据路径模式返回中文称谓与解释文案。
 *
 * 设计原则：
 * 1. 高置信路径输出精确称谓
 * 2. 信息不足以精确命名的使用半精确层描述
 * 3. 完全未知的路径使用友好兜底
 */
function describePath(
  path: RelationshipPathHop[],
  peopleById: Map<string, Person>,
): Pick<
  RelationshipInference,
  "relationship" | "inverseRelationship" | "explanation"
> {
  // --- 同一个人 ---
  if (path.length === 0) {
    return makeResult(
      "同一人",
      "同一人",
      "两个名字指向同一个人物。",
    );
  }

  const source = peopleById.get(path[0].fromPersonId);
  const target = peopleById.get(path[path.length - 1].toPersonId);
  const pattern = path.map((hop) => hop.kind).join(">");

  // ===================================================================
  // 1. 直系与一代内关系
  // ===================================================================

  // --- 配偶 ---
  if (pattern === "spouse") {
    return makeResult(
      "配偶",
      "配偶",
      "两人之间存在直接配偶关系。",
    );
  }

  // --- 父母 ---
  if (pattern === "parent") {
    return makeResult(
      directParentLabel(target?.gender),
      directChildLabel(source?.gender),
      "目标人物位于源人物上一代，属于直系亲子关系。",
    );
  }

  // --- 子女 ---
  if (pattern === "child") {
    return makeResult(
      directChildLabel(target?.gender),
      directParentLabel(source?.gender),
      "目标人物位于源人物下一代，属于直系亲子关系。",
    );
  }

  // ===================================================================
  // 2. 两跳同代 / 隔代
  // ===================================================================

  // --- 兄弟姐妹 (parent>child) ---
  if (pattern === "parent>child") {
    return makeResult(
      siblingLabel(target?.gender),
      siblingLabel(source?.gender),
      "两人共享同一位父母，因此可识别为兄弟姐妹关系。",
    );
  }

  // --- 祖父母 (parent>parent) ---
  if (pattern === "parent>parent") {
    return makeResult(
      grandparentLabel(target?.gender),
      grandchildLabel(source?.gender),
      "目标人物位于源人物上两代，属于直系祖孙关系。",
    );
  }

  // --- 孙辈 (child>child) ---
  if (pattern === "child>child") {
    return makeResult(
      grandchildLabel(target?.gender),
      grandparentLabel(source?.gender),
      "目标人物位于源人物下两代，属于直系祖孙关系。",
    );
  }

  // --- 共同子女的另一位家长 (child>parent) ---
  if (pattern === "child>parent") {
    return makeResult(
      "共同子女的另一位家长",
      "共同子女的另一位家长",
      "两人通过同一位子女相连，通常表示共同育儿或配偶关系。",
    );
  }

  // ===================================================================
  // 3. 三跳与四跳 — 旁系亲属
  // ===================================================================

  // --- 侄甥辈 (parent>child>child) ---
  // source → parent → sibling → sibling's child (target)
  if (pattern === "parent>child>child") {
    const branchPerson = peopleById.get(path[1].toPersonId);

    return makeResult(
      nephewOrNieceLabel(branchPerson?.gender, target?.gender),
      auntOrUncleLabel(source?.gender, branchPerson?.gender),
      "路径表现为「父母 → 兄弟姐妹 → 其子女」，因此目标人物是源人物的侄甥辈晚辈。",
    );
  }

  // --- 父母辈旁系长辈 (parent>parent>child) ---
  // source → parent → grandparent → grandparent's other child (target)
  if (pattern === "parent>parent>child") {
    const sourceParent = peopleById.get(path[0].toPersonId);

    return makeResult(
      auntOrUncleLabel(target?.gender, sourceParent?.gender),
      nephewOrNieceLabel(sourceParent?.gender, source?.gender),
      "路径表现为「父母 → 祖辈 → 祖辈的另一位子女」，因此目标人物是源人物父母一辈的旁系亲属。",
    );
  }

  // --- 堂表亲 (parent>parent>child>child) ---
  // source → parent → grandparent → grandparent's other child → cousin
  if (pattern === "parent>parent>child>child") {
    return makeResult(
      cousinLabel(target?.gender),
      cousinLabel(source?.gender),
      "路径表现为「上到祖辈，再下到另一支子孙」，因此两人可识别为堂表亲关系。",
    );
  }

  // ===================================================================
  // 4. 兄弟姐妹的配偶 / 配偶的兄弟姐妹（新增）
  // ===================================================================

  // --- 兄弟姐妹的配偶 (parent>child>spouse) ---
  // source → parent → sibling → sibling's spouse (target)
  // 逆向：target → 配偶的兄弟/姐妹（即 source）
  if (pattern === "parent>child>spouse") {
    const sibling = peopleById.get(path[1].toPersonId);

    return makeResult(
      siblingSpouseLabel(sibling?.gender, target?.gender),
      spouseSiblingLabel(source?.gender),
      "路径表现为「父母 → 兄弟姐妹 → 其配偶」，因此目标人物是源人物兄弟姐妹的配偶。",
    );
  }

  // --- 配偶的兄弟姐妹 (spouse>parent>child) ---
  // source → spouse → spouse's parent → spouse's sibling (target)
  // 逆向：target → 兄弟/姐妹的配偶（即 source）
  if (pattern === "spouse>parent>child") {
    const spouseSibling = peopleById.get(path[2].toPersonId);
    const spousePerson = peopleById.get(path[0].toPersonId);

    return makeResult(
      spouseSiblingLabel(spouseSibling?.gender),
      siblingSpouseLabel(spousePerson?.gender, source?.gender),
      "路径表现为「配偶 → 配偶的父母 → 配偶的兄弟姐妹」，因此目标人物是源人物配偶一方的兄弟姐妹。",
    );
  }

  // ===================================================================
  // 5. 姻亲路径
  // ===================================================================

  // --- 配偶的父母 (spouse>parent) ---
  if (pattern === "spouse>parent") {
    return makeResult(
      "姻亲长辈",
      "晚辈姻亲",
      "目标人物是配偶一侧的父母辈亲属。",
    );
  }

  // --- 配偶的子女 (spouse>child) ---
  if (pattern === "spouse>child") {
    return makeResult(
      "姻亲晚辈",
      "长辈姻亲",
      "目标人物位于配偶一侧的下一代。",
    );
  }

  // --- 父母的配偶 (parent>spouse) ---
  if (pattern === "parent>spouse") {
    return makeResult(
      "父母的配偶",
      "配偶的子女",
      "目标人物是源人物父母一侧的配偶亲属。",
    );
  }

  // ===================================================================
  // 6. 半精确层兜底 — 对未精确命名的已知层级路径
  // ===================================================================
  const profile = classifyHops(path);

  // 对有配偶参与的路径，尝试给出分层半精确描述
  if (profile.isAffine) {
    // 双重配偶路径极少出现，但仍尝试描述
    if (profile.spouse >= 2) {
      const hopLabels = formatHopLabels(path);
      return {
        relationship: "复杂姻亲关系",
        inverseRelationship: "复杂姻亲关系",
        explanation: `当前引擎找到了这条关系路径：${hopLabels}。该路径涉及多层姻亲关系，暂时无法进一步细化称谓。`,
      };
    }

    const { relationship, inverseRelationship } = semiPreciseFallback(
      profile,
      target?.gender,
    );

    return {
      relationship,
      inverseRelationship,
      explanation: `该路径涉及姻亲关系，系统将其归类为「${relationship}」。`,
    };
  }

  // --- 纯血亲但尚未精确映射的路径 ---
  const { relationship, inverseRelationship } = semiPreciseFallback(
    profile,
    target?.gender,
  );

  return {
    relationship,
    inverseRelationship,
    explanation: `系统已找到一条亲属路径，依据路径的上下代层级将其归类为「${relationship}」。后续版本可进一步细化此路径的中文称谓。`,
  };
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

export function inferRelationship(
  sourceId: string,
  targetId: string,
  people: Person[],
  relationships: Relationship[],
): RelationshipInference {
  const graph = buildGraph(relationships);
  const path = findShortestPath(sourceId, targetId, graph);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  if (path.length === 0 && sourceId !== targetId) {
    return {
      found: false,
      relationship: null,
      inverseRelationship: null,
      path: [],
      explanation: "没有找到可达的亲属路径。",
    };
  }

  const description = describePath(path, peopleById);

  return {
    found: true,
    relationship: description.relationship,
    inverseRelationship: description.inverseRelationship,
    path,
    explanation: description.explanation,
  };
}

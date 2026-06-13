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

function byTargetGender(
  targetGender: string | undefined,
  options: { male: string; female: string; unknown: string },
) {
  if (targetGender === "male") {
    return options.male;
  }

  if (targetGender === "female") {
    return options.female;
  }

  return options.unknown;
}

function directParentLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "父亲",
    female: "母亲",
    unknown: "父母",
  });
}

function directChildLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "儿子",
    female: "女儿",
    unknown: "子女",
  });
}

function siblingLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "兄弟",
    female: "姐妹",
    unknown: "兄弟姐妹",
  });
}

function grandparentLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "祖父",
    female: "祖母",
    unknown: "祖辈",
  });
}

function grandchildLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "孙子",
    female: "孙女",
    unknown: "孙辈",
  });
}

function auntOrUncleLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "伯叔舅父辈长辈",
    female: "姑姨辈长辈",
    unknown: "父母的兄弟姐妹",
  });
}

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

function cousinLabel(targetGender: string | undefined) {
  return byTargetGender(targetGender, {
    male: "堂表兄弟",
    female: "堂表姐妹",
    unknown: "堂表亲",
  });
}

function formatHopLabels(path: RelationshipPathHop[]) {
  return path
    .map((hop) => {
      if (hop.kind === "spouse") {
        return "配偶";
      }

      if (hop.kind === "parent") {
        return "父母";
      }

      return "子女";
    })
    .join(" -> ");
}

function describePath(
  path: RelationshipPathHop[],
  peopleById: Map<string, Person>,
): Pick<
  RelationshipInference,
  "relationship" | "inverseRelationship" | "explanation"
> {
  if (path.length === 0) {
    return {
      relationship: "同一人",
      inverseRelationship: "同一人",
      explanation: "两个名字指向同一个人物。",
    };
  }

  const source = peopleById.get(path[0].fromPersonId);
  const target = peopleById.get(path[path.length - 1].toPersonId);
  const pattern = path.map((hop) => hop.kind).join(">");

  if (pattern === "spouse") {
    return {
      relationship: "配偶",
      inverseRelationship: "配偶",
      explanation: "两人之间存在直接配偶关系。",
    };
  }

  if (pattern === "parent") {
    return {
      relationship: directParentLabel(target?.gender),
      inverseRelationship: directChildLabel(source?.gender),
      explanation: "目标人物位于源人物上一代。",
    };
  }

  if (pattern === "child") {
    return {
      relationship: directChildLabel(target?.gender),
      inverseRelationship: directParentLabel(source?.gender),
      explanation: "目标人物位于源人物下一代。",
    };
  }

  if (pattern === "parent>child") {
    return {
      relationship: siblingLabel(target?.gender),
      inverseRelationship: siblingLabel(source?.gender),
      explanation: "两人共享同一位父母，因此可识别为兄弟姐妹关系。",
    };
  }

  if (pattern === "parent>parent") {
    return {
      relationship: grandparentLabel(target?.gender),
      inverseRelationship: grandchildLabel(source?.gender),
      explanation: "目标人物位于源人物上两代。",
    };
  }

  if (pattern === "child>child") {
    return {
      relationship: grandchildLabel(target?.gender),
      inverseRelationship: grandparentLabel(source?.gender),
      explanation: "目标人物位于源人物下两代。",
    };
  }

  if (pattern === "child>parent") {
    return {
      relationship: "共同子女的另一位家长",
      inverseRelationship: "共同子女的另一位家长",
      explanation: "两人通过同一位子女相连，通常表示共同育儿或配偶关系。",
    };
  }

  if (pattern === "parent>child>child") {
    const branchPerson = peopleById.get(path[1].toPersonId);

    return {
      relationship: nephewOrNieceLabel(branchPerson?.gender, target?.gender),
      inverseRelationship: auntOrUncleLabel(source?.gender),
      explanation:
        "路径表现为“父母 -> 兄弟姐妹 -> 其子女”，因此目标人物是源人物的侄甥辈晚辈。",
    };
  }

  if (pattern === "parent>parent>child") {
    const sourceParent = peopleById.get(path[0].toPersonId);

    return {
      relationship: auntOrUncleLabel(target?.gender),
      inverseRelationship: nephewOrNieceLabel(sourceParent?.gender, source?.gender),
      explanation:
        "路径表现为“父母 -> 祖辈 -> 祖辈的另一位子女”，因此目标人物是源人物父母一辈的旁系亲属。",
    };
  }

  if (pattern === "parent>parent>child>child") {
    return {
      relationship: cousinLabel(target?.gender),
      inverseRelationship: cousinLabel(source?.gender),
      explanation:
        "路径表现为“上到祖辈，再下到另一支子孙”，因此两人可识别为堂表亲关系。",
    };
  }

  if (pattern === "spouse>parent") {
    return {
      relationship: "姻亲长辈",
      inverseRelationship: "晚辈姻亲",
      explanation: "目标人物是配偶一侧的父母辈亲属。",
    };
  }

  if (pattern === "spouse>child") {
    return {
      relationship: "姻亲晚辈",
      inverseRelationship: "长辈姻亲",
      explanation: "目标人物位于配偶一侧的下一代。",
    };
  }

  if (pattern === "parent>spouse") {
    return {
      relationship: "父母的配偶",
      inverseRelationship: "配偶的子女",
      explanation: "目标人物是源人物父母一侧的配偶亲属。",
    };
  }

  const hopLabels = formatHopLabels(path);

  return {
    relationship: "存在可解释的亲属路径",
    inverseRelationship: null,
    explanation: `当前引擎找到了这条关系路径：${hopLabels}。该路径尚未映射到更精确的中文称谓。`,
  };
}

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

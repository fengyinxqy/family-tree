import type { Person, Relationship } from "@prisma/client";
import type { RelationshipInference, RelationshipPathHop } from "@/lib/agent/types";

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

function genderedLabel(
  maleLabel: string,
  femaleLabel: string,
  targetGender: string,
  fallback: string,
) {
  if (targetGender === "male") {
    return maleLabel;
  }
  if (targetGender === "female") {
    return femaleLabel;
  }
  return fallback;
}

function describePath(
  path: RelationshipPathHop[],
  peopleById: Map<string, Person>,
): Pick<RelationshipInference, "relationship" | "inverseRelationship" | "explanation"> {
  if (path.length === 0) {
    return {
      relationship: "同一人",
      inverseRelationship: "同一人",
      explanation: "两个名字指向同一个人物。",
    };
  }

  const target = peopleById.get(path[path.length - 1].toPersonId);
  const source = peopleById.get(path[0].fromPersonId);
  const kinds = path.map((hop) => hop.kind);

  if (kinds.length === 1) {
    const kind = kinds[0];
    if (kind === "spouse") {
      return {
        relationship: "配偶",
        inverseRelationship: "配偶",
        explanation: "两人之间存在配偶关系。",
      };
    }

    if (kind === "parent") {
      return {
        relationship: genderedLabel("父亲", "母亲", target?.gender || "", "父母"),
        inverseRelationship: genderedLabel("儿子", "女儿", source?.gender || "", "子女"),
        explanation: "目标人物是源人物的父母。",
      };
    }

    return {
      relationship: genderedLabel("儿子", "女儿", target?.gender || "", "子女"),
      inverseRelationship: genderedLabel("父亲", "母亲", source?.gender || "", "父母"),
      explanation: "目标人物是源人物的子女。",
    };
  }

  if (kinds.join(">") === "parent>child") {
    return {
      relationship: genderedLabel("兄弟", "姐妹", target?.gender || "", "兄弟姐妹"),
      inverseRelationship: genderedLabel("兄弟", "姐妹", source?.gender || "", "兄弟姐妹"),
      explanation: "两人共享同一位父母，因此被识别为兄弟姐妹关系。",
    };
  }

  if (kinds.join(">") === "parent>parent") {
    return {
      relationship: genderedLabel("祖父", "祖母", target?.gender || "", "祖辈"),
      inverseRelationship: genderedLabel("孙子", "孙女", source?.gender || "", "孙辈"),
      explanation: "目标人物位于源人物上两代。",
    };
  }

  if (kinds.join(">") === "child>child") {
    return {
      relationship: genderedLabel("孙子", "孙女", target?.gender || "", "孙辈"),
      inverseRelationship: genderedLabel("祖父", "祖母", source?.gender || "", "祖辈"),
      explanation: "目标人物位于源人物下两代。",
    };
  }

  if (kinds.join(">") === "parent>parent>child") {
    const middle = peopleById.get(path[1].toPersonId);
    if (middle?.gender === "male") {
      return {
        relationship: "叔伯",
        inverseRelationship: genderedLabel("侄子", "侄女", source?.gender || "", "晚辈亲属"),
        explanation: "目标人物是源人物父母一辈的男性旁系亲属。",
      };
    }

    return {
      relationship: "姑姨",
      inverseRelationship: genderedLabel("外甥", "外甥女", source?.gender || "", "晚辈亲属"),
      explanation: "目标人物是源人物父母一辈的女性旁系亲属。",
    };
  }

  const hopLabels = path
    .map((hop) => {
      if (hop.kind === "spouse") return "配偶";
      if (hop.kind === "parent") return "父母";
      return "子女";
    })
    .join(" -> ");

  return {
    relationship: "存在亲属路径，但暂未命名",
    inverseRelationship: null,
    explanation: `当前引擎找到了这条关系路径：${hopLabels}。`,
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

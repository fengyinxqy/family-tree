import type { PersonData, RelationshipData, TreeNode, TreeEdge } from "@/types";

const NODE_W = 180;
const NODE_H = 80;
const H_GAP = 60;
const V_GAP = 120;
const SPOUSE_GAP = 100;

interface LayoutResult {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

/**
 * Build adjacency maps from person and relationship data.
 */
function buildMaps(persons: PersonData[], relationships: RelationshipData[]) {
  const spouseMap = new Map<string, string[]>(); // personId -> spouseIds
  const childrenMap = new Map<string, string[]>(); // personId -> childIds
  const parentMap = new Map<string, string[]>(); // personId -> parentIds

  // Initialize maps for all persons
  for (const p of persons) {
    spouseMap.set(p.id, []);
    childrenMap.set(p.id, []);
    parentMap.set(p.id, []);
  }

  for (const rel of relationships) {
    if (rel.type === "spouse") {
      const a = spouseMap.get(rel.personAId);
      const b = spouseMap.get(rel.personBId);
      if (a && !a.includes(rel.personBId)) a.push(rel.personBId);
      if (b && !b.includes(rel.personAId)) b.push(rel.personAId);
    } else if (rel.type === "child") {
      // personA is parent, personB is child
      const kids = childrenMap.get(rel.personAId);
      if (kids && !kids.includes(rel.personBId)) kids.push(rel.personBId);
      const pars = parentMap.get(rel.personBId);
      if (pars && !pars.includes(rel.personAId)) pars.push(rel.personAId);
    }
  }

  return { spouseMap, childrenMap, parentMap };
}

/**
 * Find root nodes: persons with no parents.
 */
function findRoots(persons: PersonData[], parentMap: Map<string, string[]>): string[] {
  const roots = persons.filter((p) => {
    const parents = parentMap.get(p.id);
    return !parents || parents.length === 0;
  });
  return roots.map((p) => p.id);
}

/**
 * Assign levels (generations) using BFS starting from root nodes.
 * Returns a Map of personId -> level (0-based).
 */
function assignLevels(
  persons: PersonData[],
  childrenMap: Map<string, string[]>,
  spouseMap: Map<string, string[]>,
  rootIds: string[],
): Map<string, number> {
  const explicitLevels = new Map<string, number>();
  const hasExplicitGeneration = persons.some((person) => Number.isFinite(person.generationNumber));
  if (hasExplicitGeneration) {
    for (const person of persons) {
      explicitLevels.set(person.id, Math.max(person.generationNumber - 1, 0));
    }
    return explicitLevels;
  }

  const levels = new Map<string, number>();
  const visited = new Set<string>();

  // Queue for BFS: [personId, level]
  const queue: Array<[string, number]> = [];

  for (const rootId of rootIds) {
    queue.push([rootId, 0]);
  }

  while (queue.length > 0) {
    const [personId, level] = queue.shift()!;

    if (visited.has(personId)) continue;
    visited.add(personId);
    levels.set(personId, level);

    // Enqueue children at next level
    const children = childrenMap.get(personId) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push([childId, level + 1]);
      }
    }
  }

  // Handle any nodes not reached (isolated or parentless descendants)
  for (const p of persons) {
    if (!levels.has(p.id)) {
      levels.set(p.id, 0);
    }
  }

  return levels;
}

/**
 * Build edges for the tree visualization.
 */
function buildEdges(
  persons: PersonData[],
  spouseMap: Map<string, string[]>,
  childrenMap: Map<string, string[]>,
  relationships: RelationshipData[],
): TreeEdge[] {
  const edges: TreeEdge[] = [];
  const addedSpouse = new Set<string>();

  for (const p of persons) {
    // Spouse edges (bidirectional, only add once per pair)
    const spouses = spouseMap.get(p.id) || [];
    for (const spId of spouses) {
      const pairKey = [p.id, spId].sort().join("--");
      if (!addedSpouse.has(pairKey)) {
        addedSpouse.add(pairKey);
        const rel = relationships.find(
          (r) => r.type === "spouse" &&
            ((r.personAId === p.id && r.personBId === spId) ||
             (r.personAId === spId && r.personBId === p.id))
        );
        // 男方 source(右) → 女方 target(左)
        const pMale = p.gender === "male";
        const maleId = pMale ? p.id : spId;
        const femaleId = pMale ? spId : p.id;
        edges.push({
          id: `spouse-${pairKey}`,
          source: maleId,
          target: femaleId,
          sourceHandle: "right",
          targetHandle: "left",
          type: "spouse",
          label: rel?.label ?? null,
        });
      }
    }

    // Parent-child edges
    const children = childrenMap.get(p.id) || [];
    for (const childId of children) {
      const rel = relationships.find(
        (r) => r.type === "child" && r.personAId === p.id && r.personBId === childId
      );
      edges.push({
        id: `child-${p.id}-${childId}`,
        source: p.id,
        target: childId,
        type: "parent-child",
        label: rel?.label ?? null,
      });
    }
  }

  return edges;
}

/**
 * Distribute nodes on the x-axis within each level, respecting spouse adjacency.
 */
function distributePositions(
  persons: PersonData[],
  levels: Map<string, number>,
  spouseMap: Map<string, string[]>,
  _childrenMap: Map<string, string[]>,
  _parentMap: Map<string, string[]>,
): Map<string, { x: number; y: number }> {
  void _childrenMap;
  void _parentMap;
  const positions = new Map<string, { x: number; y: number }>();

  // Group persons by level
  const levelGroups = new Map<number, string[]>();
  for (const [personId, level] of levels) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(personId);
  }

  // Sort levels and process each level
  const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b);

  // Track spouse "groups" — spouses should sit next to each other
  // We'll build connected components (subgraphs) of the spouse graph
  const spouseComponents = findSpouseComponents(spouseMap, [...spouseMap.keys()]);

  for (const level of sortedLevels) {
    const nodeIds = levelGroups.get(level) || [];
    const positionedInLevel = new Set<string>();
    const orderedGroups: string[][] = [];

    // First, group unmarried nodes together in spouse components
    const remaining = new Set(nodeIds);

    // Assign nodes to their spouse component groups
    for (const comp of spouseComponents) {
      const inLevel = comp.filter((id) => remaining.has(id));
      if (inLevel.length > 0) {
        orderedGroups.push(inLevel);
        for (const id of inLevel) remaining.delete(id);
      }
    }

    // Remaining nodes (not in any spouse group) get their own group
    for (const id of remaining) {
      orderedGroups.push([id]);
    }

    // 先计算每个组的实际宽度
    const groupWidths: number[] = [];
    let totalWidth = 0;
    for (const group of orderedGroups) {
      const sortedGroup = [...group].sort((a, b) => {
        const pa = persons.find((x: PersonData) => x.id === a);
        const pb = persons.find((x: PersonData) => x.id === b);
        const aMale = pa?.gender === "male";
        const bMale = pb?.gender === "male";
        return aMale ? -1 : bMale ? 1 : 0;
      });
      const gap = sortedGroup.length > 1 ? SPOUSE_GAP : 0;
      const w = sortedGroup.length * NODE_W + (sortedGroup.length - 1) * gap;
      groupWidths.push(w);
      totalWidth += w;
    }
    totalWidth += (orderedGroups.length - 1) * H_GAP;
    let startX = -totalWidth / 2;

    for (let gi = 0; gi < orderedGroups.length; gi++) {
      const group = orderedGroups[gi];
      const groupWidth = groupWidths[gi];
      const sortedGroup = [...group].sort((a, b) => {
        const pa = persons.find((x: PersonData) => x.id === a);
        const pb = persons.find((x: PersonData) => x.id === b);
        const aMale = pa?.gender === "male";
        const bMale = pb?.gender === "male";
        return aMale ? -1 : bMale ? 1 : 0;
      });
      const gap = sortedGroup.length > 1 ? SPOUSE_GAP : 0;
      let groupStartX = startX;

      for (const nodeId of sortedGroup) {
        positionedInLevel.add(nodeId);

        positions.set(nodeId, {
          x: groupStartX + NODE_W / 2,
          y: level * (NODE_H + V_GAP),
        });
        groupStartX += NODE_W + gap;
      }
      startX += groupWidth + H_GAP;
    }
  }

  return positions;
}

/**
 * Find connected components in the spouse graph using DFS.
 */
function findSpouseComponents(
  spouseMap: Map<string, string[]>,
  allIds: string[],
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of allIds) {
    if (visited.has(id)) continue;

    const component: string[] = [];
    const stack = [id];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);

      const spouses = spouseMap.get(current) || [];
      for (const spId of spouses) {
        if (!visited.has(spId)) {
          stack.push(spId);
        }
      }
    }

    if (component.length > 1) {
      components.push(component);
    }
  }

  return components;
}

/**
 * Create tree nodes with computed positions and relationship data.
 */
function buildNodes(
  persons: PersonData[],
  positions: Map<string, { x: number; y: number }>,
  spouseMap: Map<string, string[]>,
  childrenMap: Map<string, string[]>,
  parentMap: Map<string, string[]>,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  for (const p of persons) {
    const pos = positions.get(p.id) || { x: 0, y: 0 };

    // 优先使用已保存的位置
    const finalPos = p.posX != null && p.posY != null
      ? { x: p.posX, y: p.posY }
      : pos;

    nodes.push({
      id: p.id,
      type: "person",
      position: finalPos,
      data: {
        ...p,
        spouseIds: spouseMap.get(p.id) || [],
        childrenIds: childrenMap.get(p.id) || [],
        parentIds: parentMap.get(p.id) || [],
      },
    });
  }

  return nodes;
}

/**
 * Layout the family tree vertically (top-down): ancestors at top, descendants below.
 */
export function layoutVertical(
  persons: PersonData[],
  relationships: RelationshipData[],
): LayoutResult {
  if (persons.length === 0) return { nodes: [], edges: [] };

  const { spouseMap, childrenMap, parentMap } = buildMaps(persons, relationships);
  const rootIds = findRoots(persons, parentMap);
  const levels = assignLevels(persons, childrenMap, spouseMap, rootIds);
  const positions = distributePositions(persons, levels, spouseMap, childrenMap, parentMap);
  const nodes = buildNodes(persons, positions, spouseMap, childrenMap, parentMap);
  const edges = buildEdges(persons, spouseMap, childrenMap, relationships);

  return { nodes, edges };
}

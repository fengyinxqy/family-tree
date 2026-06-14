import type {
  PersonData,
  PersonEventData,
  RelationshipData,
  WorkspacePersonData,
} from "@/types";

export interface GenerationGroup {
  key: string;
  level: number;
  label: string;
  personIds: string[];
}

export interface TimelineEntry {
  id: string;
  personId: string;
  personName: string;
  title: string;
  type: PersonEventData["type"];
  dateLabel: string | null;
  location: string | null;
  description: string | null;
  isSystem: boolean;
}

export interface SuggestionChip {
  id: string;
  label: string;
  question: string;
}

export interface SuggestionHint {
  id: string;
  title: string;
  description: string;
}

export function buildFamilyMaps(
  persons: Pick<PersonData, "id">[],
  relationships: RelationshipData[],
) {
  const spouseMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string[]>();

  for (const person of persons) {
    spouseMap.set(person.id, []);
    childrenMap.set(person.id, []);
    parentMap.set(person.id, []);
  }

  for (const relationship of relationships) {
    if (relationship.type === "spouse") {
      spouseMap.get(relationship.personAId)?.push(relationship.personBId);
      spouseMap.get(relationship.personBId)?.push(relationship.personAId);
      continue;
    }

    childrenMap.get(relationship.personAId)?.push(relationship.personBId);
    parentMap.get(relationship.personBId)?.push(relationship.personAId);
  }

  for (const map of [spouseMap, childrenMap, parentMap]) {
    for (const [key, values] of map) {
      map.set(key, [...new Set(values)]);
    }
  }

  return { spouseMap, childrenMap, parentMap };
}

export function getRootPersonIds(
  persons: Pick<PersonData, "id">[],
  relationships: RelationshipData[],
) {
  const { parentMap } = buildFamilyMaps(persons, relationships);

  return persons
    .filter((person) => (parentMap.get(person.id) ?? []).length === 0)
    .map((person) => person.id);
}

export function getGenerationGroups(
  persons: Pick<PersonData, "id" | "generationLabel">[],
  relationships: RelationshipData[],
): GenerationGroup[] {
  const { spouseMap, childrenMap } = buildFamilyMaps(persons, relationships);
  const roots = getRootPersonIds(persons, relationships);
  const levels = new Map<string, number>();
  const queue: Array<[string, number]> = roots.map((rootId) => [rootId, 0]);

  while (queue.length > 0) {
    const [personId, level] = queue.shift()!;
    const existing = levels.get(personId);
    // 单调检查：已有更优层级则跳过
    if (existing !== undefined && existing >= level) continue;
    levels.set(personId, level);

    // 子女：level + 1
    for (const childId of childrenMap.get(personId) ?? []) {
      const childExisting = levels.get(childId);
      if (childExisting === undefined || childExisting < level + 1) {
        queue.push([childId, level + 1]);
      }
    }

    // 配偶：同 level（同代人）
    for (const spouseId of spouseMap.get(personId) ?? []) {
      const spouseExisting = levels.get(spouseId);
      if (spouseExisting === undefined || spouseExisting < level) {
        queue.push([spouseId, level]);
      }
    }
  }

  for (const person of persons) {
    if (!levels.has(person.id)) {
      levels.set(person.id, 0);
    }
  }

  const grouped = new Map<number, string[]>();
  for (const person of persons) {
    const level = levels.get(person.id) ?? 0;
    const current = grouped.get(level) ?? [];
    current.push(person.id);
    grouped.set(level, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([level, personIds]) => {
      const labelSeed = persons.find((person) => personIds.includes(person.id))?.generationLabel;
      return {
        key: `g-${level}`,
        level,
        label: labelSeed?.trim() || `第 ${level + 1} 代`,
        personIds,
      };
    });
}

export function getBranchPersonIds(
  rootPersonId: string,
  persons: Pick<PersonData, "id">[],
  relationships: RelationshipData[],
) {
  const { spouseMap, childrenMap } = buildFamilyMaps(persons, relationships);
  const visited = new Set<string>();
  const queue = [rootPersonId];

  while (queue.length > 0) {
    const personId = queue.shift()!;
    if (visited.has(personId)) {
      continue;
    }
    visited.add(personId);

    for (const spouseId of spouseMap.get(personId) ?? []) {
      if (!visited.has(spouseId)) {
        queue.push(spouseId);
      }
    }

    for (const childId of childrenMap.get(personId) ?? []) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return visited;
}

export function buildWorkspaceTimeline(
  persons: WorkspacePersonData[],
  relationships: RelationshipData[],
  options?: {
    selectedPersonId?: string | null;
    generationKey?: string | null;
    branchRootId?: string | null;
  },
) {
  const generationGroups = getGenerationGroups(persons, relationships);
  const generationFilter = options?.generationKey
    ? generationGroups.find((group) => group.key === options.generationKey)
    : null;
  const branchFilter = options?.branchRootId
    ? getBranchPersonIds(options.branchRootId, persons, relationships)
    : null;

  return persons
    .filter((person) => {
      if (options?.selectedPersonId) {
        return person.id === options.selectedPersonId;
      }

      if (generationFilter && !generationFilter.personIds.includes(person.id)) {
        return false;
      }

      if (branchFilter && !branchFilter.has(person.id)) {
        return false;
      }

      return true;
    })
    .flatMap((person) => {
      const entries: TimelineEntry[] = [];
      const seenTypes = new Set(person.events.map((event) => event.type));

      if (person.birthDate && !seenTypes.has("birth")) {
        entries.push({
          id: `${person.id}-birth`,
          personId: person.id,
          personName: person.name,
          title: "出生",
          type: "birth",
          dateLabel: person.birthDate,
          location: null,
          description: null,
          isSystem: true,
        });
      }

      if (person.deathDate && !seenTypes.has("death")) {
        entries.push({
          id: `${person.id}-death`,
          personId: person.id,
          personName: person.name,
          title: "离世",
          type: "death",
          dateLabel: person.deathDate,
          location: null,
          description: null,
          isSystem: true,
        });
      }

      for (const event of person.events) {
        entries.push({
          id: event.id,
          personId: person.id,
          personName: person.name,
          title: event.title || eventTypeLabel(event.type),
          type: event.type,
          dateLabel: event.dateLabel,
          location: event.location,
          description: event.description,
          isSystem: false,
        });
      }

      return entries;
    })
    .sort((left, right) => {
      const leftDate = left.dateLabel ?? "9999";
      const rightDate = right.dateLabel ?? "9999";
      return leftDate.localeCompare(rightDate) || left.personName.localeCompare(right.personName);
    });
}

export function buildSuggestionChips(person: WorkspacePersonData | null): SuggestionChip[] {
  if (!person) {
    return [
      {
        id: "family-overview",
        label: "梳理当前家谱",
        question: "请帮我梳理当前家谱里最明显的缺口和下一步维护建议。",
      },
    ];
  }

  return [
    {
      id: `${person.id}-parents`,
      label: "父母关系",
      question: `请结合当前家谱，告诉我 ${person.name} 的父母是谁。`,
    },
    {
      id: `${person.id}-children`,
      label: "子女关系",
      question: `请结合当前家谱，告诉我 ${person.name} 的子女还有谁。`,
    },
    {
      id: `${person.id}-kinship`,
      label: "常见亲属称谓",
      question: `请基于当前家谱，帮我总结 ${person.name} 在家族中的关键亲属关系。`,
    },
  ];
}

export function buildSuggestionHints(
  person: WorkspacePersonData | null,
  relationships: RelationshipData[],
): SuggestionHint[] {
  if (!person) {
    return [
      {
        id: "workspace-hint",
        title: "先选中一个成员",
        description: "这样助手就能围绕这个人给出更具体的信息补全和关系建议。",
      },
    ];
  }

  const { spouseMap, childrenMap, parentMap } = buildFamilyMaps([person], relationships.filter(
    (relationship) =>
      relationship.personAId === person.id || relationship.personBId === person.id,
  ));

  const hints: SuggestionHint[] = [];

  if ((parentMap.get(person.id) ?? []).length === 0) {
    hints.push({
      id: `${person.id}-missing-parents`,
      title: "父母信息仍缺失",
      description: `可以补充 ${person.name} 的父母关系，帮助树结构和代际定位更完整。`,
    });
  }

  if ((spouseMap.get(person.id) ?? []).length === 0) {
    hints.push({
      id: `${person.id}-missing-spouse`,
      title: "尚未记录配偶",
      description: `如果 ${person.name} 存在婚配关系，现在可以补上，让分支图和世系表更完整。`,
    });
  }

  if ((childrenMap.get(person.id) ?? []).length === 0) {
    hints.push({
      id: `${person.id}-missing-children`,
      title: "还没有子女记录",
      description: `如果 ${person.name} 有后代，可以继续补充子女关系，完善后续代际。`,
    });
  }

  if (hints.length === 0) {
    hints.push({
      id: `${person.id}-stable`,
      title: "当前成员关系较完整",
      description: `可以继续围绕 ${person.name} 的生平事件、籍贯和备注信息做资料补全。`,
    });
  }

  return hints;
}

export function getPersonNameMap(persons: Pick<PersonData, "id" | "name">[]) {
  return new Map(persons.map((person) => [person.id, person.name]));
}

function eventTypeLabel(type: PersonEventData["type"]) {
  switch (type) {
    case "birth":
      return "出生";
    case "death":
      return "离世";
    case "marriage":
      return "婚姻";
    case "migration":
      return "迁徙";
    default:
      return "事件";
  }
}

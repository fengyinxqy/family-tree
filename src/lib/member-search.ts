import type { Node } from "@xyflow/react";
import type { PersonData } from "@/types";

const SEARCH_RESULT_LIMIT = 8;

export type MemberSearchMatch = {
  person: PersonData;
  matchedBy: "name" | "alias";
  score: number;
};

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function buildSearchVariants(person: PersonData) {
  return [
    { value: person.name, matchedBy: "name" as const },
    ...person.aliases.map((alias) => ({
      value: alias,
      matchedBy: "alias" as const,
    })),
  ];
}

function scoreSearchValue(value: string, query: string) {
  if (value === query) return 400;
  if (value.startsWith(query)) return 300;
  if (value.includes(query)) return 200;
  return -1;
}

export function filterMemberSearchResults(persons: PersonData[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return [];

  return persons
    .map((person) => {
      let bestMatch: MemberSearchMatch | null = null;

      for (const variant of buildSearchVariants(person)) {
        const normalizedValue = normalizeSearchValue(variant.value);
        const score = scoreSearchValue(normalizedValue, normalizedQuery);
        if (score < 0) continue;

        const weightedScore =
          score +
          (variant.matchedBy === "name" ? 50 : 0) +
          Math.max(0, 20 - normalizedValue.length);

        if (!bestMatch || weightedScore > bestMatch.score) {
          bestMatch = {
            person,
            matchedBy: variant.matchedBy,
            score: weightedScore,
          };
        }
      }

      return bestMatch;
    })
    .filter((match): match is MemberSearchMatch => match !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.person.name.localeCompare(b.person.name, "zh-CN");
    })
    .slice(0, SEARCH_RESULT_LIMIT);
}

export function formatMemberSearchMeta(person: PersonData) {
  const genderLabel = person.gender === "male" ? "男" : "女";
  const birthYear = person.birthDate
    ? new Date(person.birthDate).getFullYear()
    : null;
  const deathYear = person.deathDate
    ? new Date(person.deathDate).getFullYear()
    : null;

  return {
    genderLabel,
    birthYear,
    deathYear,
  };
}

export function syncHighlightedNodes(nodes: Node[], highlightedNodeId: string | null) {
  return nodes.map((node) => {
    const isHighlighted = node.id === highlightedNodeId;
    if ((node.data as Record<string, unknown>).highlighted === isHighlighted) {
      return node;
    }

    return {
      ...node,
      data: {
        ...(node.data as Record<string, unknown>),
        highlighted: isHighlighted,
      },
    };
  });
}

export function getTreeFocusTarget(nodes: Node[], personId: string) {
  const node = nodes.find((item) => item.id === personId);
  if (!node) return null;

  return {
    x: node.position.x + 95,
    y: node.position.y + 40,
  };
}

export { SEARCH_RESULT_LIMIT };

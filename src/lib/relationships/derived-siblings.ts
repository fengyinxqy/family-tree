export interface SiblingDerivationCandidate {
  parentId: string;
  parentName: string;
  sibling: {
    id: string;
    name: string;
    gender: string;
  };
}

export interface DerivedSiblingRelation {
  personId: string;
  name: string;
  gender: string;
  relationLabel: "兄弟" | "兄妹" | "姐妹";
  sharedParentNames: string[];
}

export function getSiblingRelationLabel(
  currentGender: string | undefined,
  siblingGender: string | undefined,
): DerivedSiblingRelation["relationLabel"] {
  if (currentGender === "male" && siblingGender === "male") {
    return "兄弟";
  }

  if (currentGender === "female" && siblingGender === "female") {
    return "姐妹";
  }

  return "兄妹";
}

export function deriveSiblingRelations(
  currentPersonId: string,
  currentGender: string | undefined,
  candidates: SiblingDerivationCandidate[],
): DerivedSiblingRelation[] {
  const siblings = new Map<
    string,
    {
      personId: string;
      name: string;
      gender: string;
      relationLabel: DerivedSiblingRelation["relationLabel"];
      sharedParentNames: Set<string>;
    }
  >();

  for (const candidate of candidates) {
    if (candidate.sibling.id === currentPersonId) {
      continue;
    }

    const existing = siblings.get(candidate.sibling.id);
    if (existing) {
      existing.sharedParentNames.add(candidate.parentName);
      continue;
    }

    siblings.set(candidate.sibling.id, {
      personId: candidate.sibling.id,
      name: candidate.sibling.name,
      gender: candidate.sibling.gender,
      relationLabel: getSiblingRelationLabel(currentGender, candidate.sibling.gender),
      sharedParentNames: new Set([candidate.parentName]),
    });
  }

  return [...siblings.values()]
    .map((sibling) => ({
      personId: sibling.personId,
      name: sibling.name,
      gender: sibling.gender,
      relationLabel: sibling.relationLabel,
      sharedParentNames: [...sibling.sharedParentNames].sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

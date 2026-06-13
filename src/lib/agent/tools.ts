import { prisma } from "@/lib/prisma";
import type { IntakeDraft, IntakeExtraction, ExistingPersonContext } from "./types";
import { intakeDraftSchema } from "./schemas";

export async function getUserGenealogyContext(userId: string) {
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.relationship.findMany({
      where: {
        personA: { createdBy: userId },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { persons, relationships };
}

export function toExistingPersonContext(
  persons: Awaited<ReturnType<typeof getUserGenealogyContext>>["persons"],
): ExistingPersonContext[] {
  return persons.map((person) => ({
    id: person.id,
    name: person.name,
    gender: person.gender as "male" | "female",
    birthDate: person.birthDate,
    deathDate: person.deathDate,
  }));
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function findPersonsByName(
  persons: ExistingPersonContext[],
  name: string,
) {
  const normalized = normalizeName(name);
  const exact = persons.filter((person) => normalizeName(person.name) === normalized);

  if (exact.length > 0) {
    return exact;
  }

  return persons.filter((person) => normalizeName(person.name).includes(normalized));
}

function ensureReferencedExistingPersons(
  draftPersons: IntakeDraft["persons"],
  extraction: IntakeExtraction,
  existingPersons: ExistingPersonContext[],
) {
  const persons = [...draftPersons];
  const existingIds = new Set(existingPersons.map((person) => person.id));
  const currentRefs = new Set(persons.map((person) => person.ref));

  for (const relationship of extraction.relationships) {
    for (const ref of [relationship.personARef, relationship.personBRef]) {
      if (!existingIds.has(ref) || currentRefs.has(ref)) {
        continue;
      }

      const existingPerson = existingPersons.find((person) => person.id === ref);
      if (!existingPerson) {
        continue;
      }

      persons.push({
        ref,
        action: "reuse",
        existingPersonId: existingPerson.id,
        name: existingPerson.name,
        gender: existingPerson.gender,
        birthDate: existingPerson.birthDate,
        deathDate: existingPerson.deathDate,
        bio: null,
        evidence: relationship.evidence,
      });
      currentRefs.add(ref);
    }
  }

  return persons;
}

export function buildIntakeDraft(
  extraction: IntakeExtraction,
  existingPersons: ExistingPersonContext[],
  existingRelationships: Awaited<ReturnType<typeof getUserGenealogyContext>>["relationships"],
): IntakeDraft {
  const ambiguities: IntakeDraft["ambiguities"] = [];

  const mappedPersons = extraction.persons.map((candidate) => {
    const matches = findPersonsByName(existingPersons, candidate.name);

    if (matches.length === 1) {
      return {
        ref: candidate.ref,
        action: "reuse" as const,
        existingPersonId: matches[0].id,
        name: matches[0].name,
        gender: candidate.gender,
        birthDate: candidate.birthDate,
        deathDate: candidate.deathDate,
        bio: candidate.bio,
        evidence: candidate.evidence,
      };
    }

    if (matches.length > 1) {
      ambiguities.push({
        kind: "person_match",
        message: `“${candidate.name}”匹配到多个人物，请人工确认。`,
        relatedRefs: [candidate.ref],
        options: matches.map((person) => `${person.name} (${person.id})`),
      });
    }

    if (candidate.gender === "unknown") {
      ambiguities.push({
        kind: "person_match",
        message: `“${candidate.name}”的性别还不明确，建议先确认再落库。`,
        relatedRefs: [candidate.ref],
        options: ["male", "female"],
      });
    }

    return {
      ref: candidate.ref,
      action: "create" as const,
      existingPersonId: null,
      name: candidate.name,
      gender: candidate.gender,
      birthDate: candidate.birthDate,
      deathDate: candidate.deathDate,
      bio: candidate.bio,
      evidence: candidate.evidence,
    };
  });

  const persons = ensureReferencedExistingPersons(mappedPersons, extraction, existingPersons);
  const personRefSet = new Set(persons.map((person) => person.ref));

  const relationships = extraction.relationships.map((relationship) => {
    if (relationship.personARef === relationship.personBRef) {
      ambiguities.push({
        kind: "missing_reference",
        message: `关系 ${relationship.ref} 的两端指向了同一个人物，已标记为跳过。`,
        relatedRefs: [relationship.personARef],
        options: [],
      });

      return {
        ref: relationship.ref,
        action: "skip" as const,
        type: relationship.type,
        personARef: relationship.personARef,
        personBRef: relationship.personBRef,
        label: relationship.label,
        evidence: relationship.evidence,
        reason: "self_reference",
      };
    }

    if (!personRefSet.has(relationship.personARef) || !personRefSet.has(relationship.personBRef)) {
      ambiguities.push({
        kind: "missing_reference",
        message: `关系 ${relationship.ref} 引用了不存在的人物引用。`,
        relatedRefs: [relationship.personARef, relationship.personBRef],
        options: persons.map((person) => `${person.ref}: ${person.name}`),
      });

      return {
        ref: relationship.ref,
        action: "skip" as const,
        type: relationship.type,
        personARef: relationship.personARef,
        personBRef: relationship.personBRef,
        label: relationship.label,
        evidence: relationship.evidence,
        reason: "missing_reference",
      };
    }

    const personA = persons.find((person) => person.ref === relationship.personARef);
    const personB = persons.find((person) => person.ref === relationship.personBRef);

    const existingPersonAId = personA?.existingPersonId;
    const existingPersonBId = personB?.existingPersonId;

    const duplicate = existingPersonAId && existingPersonBId
      ? existingRelationships.some((existing) => {
          if (relationship.type === "spouse") {
            return existing.type === "spouse" && (
              (existing.personAId === existingPersonAId && existing.personBId === existingPersonBId) ||
              (existing.personAId === existingPersonBId && existing.personBId === existingPersonAId)
            );
          }

          return (
            existing.type === "child" &&
            existing.personAId === existingPersonAId &&
            existing.personBId === existingPersonBId
          );
        })
      : false;

    if (duplicate) {
      ambiguities.push({
        kind: "duplicate_relationship",
        message: `关系 ${relationship.ref} 与现有数据重复，已标记为跳过。`,
        relatedRefs: [relationship.personARef, relationship.personBRef],
        options: [],
      });

      return {
        ref: relationship.ref,
        action: "skip" as const,
        type: relationship.type,
        personARef: relationship.personARef,
        personBRef: relationship.personBRef,
        label: relationship.label,
        evidence: relationship.evidence,
        reason: "duplicate_relationship",
      };
    }

    return {
      ref: relationship.ref,
      action: "create" as const,
      type: relationship.type,
      personARef: relationship.personARef,
      personBRef: relationship.personBRef,
      label: relationship.label,
      evidence: relationship.evidence,
      reason: null,
    };
  });

  const draft = {
    summary: extraction.summary,
    persons,
    relationships,
    ambiguities,
    questions: extraction.questions,
    readyToApply: ambiguities.length === 0,
  };

  return intakeDraftSchema.parse(draft);
}

export async function applyIntakeDraft(userId: string, draftInput: IntakeDraft) {
  const draft = intakeDraftSchema.parse(draftInput);
  const refToPersonId = new Map<string, string>();

  const created = await prisma.$transaction(async (tx) => {
    for (const person of draft.persons) {
      if (person.action === "reuse" && person.existingPersonId) {
        const existingPerson = await tx.person.findUnique({
          where: { id: person.existingPersonId },
        });

        if (!existingPerson || existingPerson.createdBy !== userId) {
          throw new Error(`Person ${person.name} cannot be reused by this user.`);
        }

        refToPersonId.set(person.ref, person.existingPersonId);
        continue;
      }

      if (person.gender === "unknown") {
        throw new Error(`Person ${person.name} still has unknown gender and cannot be applied.`);
      }

      const createdPerson = await tx.person.create({
        data: {
          name: person.name,
          gender: person.gender,
          birthDate: person.birthDate,
          deathDate: person.deathDate,
          bio: person.bio,
          createdBy: userId,
        },
      });

      refToPersonId.set(person.ref, createdPerson.id);
    }

    const createdRelationships = [];

    for (const relationship of draft.relationships) {
      if (relationship.action !== "create") {
        continue;
      }

      const personAId = refToPersonId.get(relationship.personARef);
      const personBId = refToPersonId.get(relationship.personBRef);

      if (!personAId || !personBId) {
        continue;
      }

      const createdRelationship = await tx.relationship.create({
        data: {
          type: relationship.type,
          personAId,
          personBId,
          label: relationship.label,
        },
      });

      createdRelationships.push(createdRelationship);
    }

    return {
      personIdsByRef: Object.fromEntries(refToPersonId.entries()),
      createdRelationships,
    };
  });

  return created;
}

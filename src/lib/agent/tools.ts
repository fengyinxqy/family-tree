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
        message: `"${candidate.name}"匹配到多个人物，请人工确认。`,
        relatedRefs: [candidate.ref],
        options: matches.map((person) => `${person.name} (${person.id})`),
      });
    }

    if (candidate.gender === "unknown") {
      ambiguities.push({
        kind: "person_gender_unknown",
        message: `"${candidate.name}"的性别还不明确，建议先确认再落库。`,
        relatedRefs: [candidate.ref],
        options: ["male", "female"],
        question: `请问"${candidate.name}"的性别是？`,
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
    readyToApply: ambiguities.length === 0 && (persons.length > 0 || relationships.length > 0),
  };

  return intakeDraftSchema.parse(draft);
}

/**
 * 将 LLM 增量提取结果按字段级规则合并到前轮草稿。
 *
 * 合并规则：
 * 1. 复用结果不可回退：action="reuse" 的人物保留 existingPersonId，不允许变为 create
 * 2. 与歧义相关的字段允许补全：action="create" 的人物可补全 gender/birthDate/deathDate/bio/evidence
 * 3. 关系恢复：此前因 missing_reference 等原因 skip 的关系，若补充文本补齐引用则可恢复为 create
 * 4. 新条目追加：新增的人物和关系直接追加
 * 5. 歧义管理：已解决的歧义移除，新出现的歧义追加
 * 6. 重新计算 readyToApply
 */
export function mergeDraftWithClarification(
  previousDraft: IntakeDraft,
  incrementalExtraction: IntakeExtraction,
  existingPersons: ExistingPersonContext[],
  existingRelationships: Awaited<ReturnType<typeof getUserGenealogyContext>>["relationships"],
): IntakeDraft {
  const prevPersonByRef = new Map(previousDraft.persons.map((p) => [p.ref, p]));
  const prevRelationshipByRef = new Map(
    previousDraft.relationships.map((r) => [r.ref, r]),
  );
  const updatedPersonRefs = new Set<string>();
  const updatedRelationshipRefs = new Set<string>();

  // --- 1. 处理增量人物 ---
  const mergedPersons: IntakeDraft["persons"] = [];

  for (const incPerson of incrementalExtraction.persons) {
    const prev = prevPersonByRef.get(incPerson.ref);

    if (prev) {
      updatedPersonRefs.add(incPerson.ref);

      if (prev.action === "reuse") {
        // 规则 1: 复用结果不可回退
        mergedPersons.push({
          ...prev,
          // 允许补全之前未知的字段
          gender: prev.gender === "unknown" && incPerson.gender !== "unknown" ? incPerson.gender : prev.gender,
          birthDate: prev.birthDate ?? incPerson.birthDate,
          deathDate: prev.deathDate ?? incPerson.deathDate,
          bio: prev.bio ?? incPerson.bio,
          evidence: incPerson.evidence || prev.evidence,
        });
      } else {
        // 规则 2: create 人物允许补全字段，并重新检查是否存在唯一匹配
        const matches = findPersonsByName(existingPersons, incPerson.name);
        const canReuse = matches.length === 1;

        mergedPersons.push({
          ref: prev.ref,
          action: canReuse ? "reuse" : "create",
          existingPersonId: canReuse ? matches[0].id : null,
          name: prev.name,
          // 补全字段
          gender:
            prev.gender === "unknown" && incPerson.gender !== "unknown"
              ? incPerson.gender
              : prev.gender,
          birthDate: prev.birthDate ?? incPerson.birthDate,
          deathDate: prev.deathDate ?? incPerson.deathDate,
          bio: prev.bio ?? incPerson.bio,
          evidence: incPerson.evidence || prev.evidence,
        });
      }

      continue;
    }

    // 尝试通过 name 匹配前一轮 draft 中尚未被更新的 create 人物
    const nameMatch = [...prevPersonByRef.values()].find(
      (p) =>
        p.name === incPerson.name &&
        p.action === "create" &&
        !updatedPersonRefs.has(p.ref),
    );

    if (nameMatch) {
      updatedPersonRefs.add(nameMatch.ref);
      const matches = findPersonsByName(existingPersons, incPerson.name);
      const canReuse = matches.length === 1;

      mergedPersons.push({
        ref: nameMatch.ref,
        action: canReuse ? "reuse" : "create",
        existingPersonId: canReuse ? matches[0].id : null,
        name: nameMatch.name,
        gender:
          nameMatch.gender === "unknown" && incPerson.gender !== "unknown"
            ? incPerson.gender
            : nameMatch.gender,
        birthDate: nameMatch.birthDate ?? incPerson.birthDate,
        deathDate: nameMatch.deathDate ?? incPerson.deathDate,
        bio: nameMatch.bio ?? incPerson.bio,
        evidence: incPerson.evidence || nameMatch.evidence,
      });

      continue;
    }

    // 全新人物
    const matches = findPersonsByName(existingPersons, incPerson.name);
    const canReuse = matches.length === 1;

    mergedPersons.push({
      ref: incPerson.ref,
      action: canReuse ? "reuse" : "create",
      existingPersonId: canReuse ? matches[0].id : null,
      name: incPerson.name,
      gender: incPerson.gender,
      birthDate: incPerson.birthDate,
      deathDate: incPerson.deathDate,
      bio: incPerson.bio,
      evidence: incPerson.evidence,
    });
  }

  // 保留未更新的原草稿人物
  for (const prev of previousDraft.persons) {
    if (!updatedPersonRefs.has(prev.ref)) {
      mergedPersons.push(prev);
    }
  }

  // --- 2. 处理增量关系 ---
  const mergedRelationships: IntakeDraft["relationships"] = [];
  const personRefSet = new Set(mergedPersons.map((p) => p.ref));

  for (const incRel of incrementalExtraction.relationships) {
    const prev = prevRelationshipByRef.get(incRel.ref);

    if (prev) {
      updatedRelationshipRefs.add(incRel.ref);

      if (prev.action === "skip" && prev.reason === "missing_reference") {
        // 规则 3: 此前因 missing_reference skip 的关系，若现在引用已补全则恢复为 create
        const canRestore =
          personRefSet.has(incRel.personARef) && personRefSet.has(incRel.personBRef);

        mergedRelationships.push({
          ...prev,
          action: canRestore ? "create" : "skip",
          type: incRel.type,
          personARef: incRel.personARef,
          personBRef: incRel.personBRef,
          label: incRel.label ?? prev.label,
          evidence: incRel.evidence || prev.evidence,
          reason: canRestore ? null : prev.reason,
        });
      } else if (prev.action === "skip" && prev.reason === "self_reference") {
        // self_reference 也可以被修正
        const isFixed = incRel.personARef !== incRel.personBRef;
        mergedRelationships.push({
          ...prev,
          action: isFixed ? "create" : "skip",
          type: incRel.type,
          personARef: incRel.personARef,
          personBRef: incRel.personBRef,
          label: incRel.label ?? prev.label,
          evidence: incRel.evidence || prev.evidence,
          reason: isFixed ? null : "self_reference",
        });
      } else {
        // 已确认的关系保持不变
        mergedRelationships.push({
          ...prev,
          type: incRel.type,
          personARef: incRel.personARef,
          personBRef: incRel.personBRef,
          label: incRel.label ?? prev.label,
          evidence: incRel.evidence || prev.evidence,
        });
      }

      continue;
    }

    // 全新关系
    const personA = mergedPersons.find((p) => p.ref === incRel.personARef);
    const personB = mergedPersons.find((p) => p.ref === incRel.personBRef);

    if (!personRefSet.has(incRel.personARef) || !personRefSet.has(incRel.personBRef)) {
      mergedRelationships.push({
        ref: incRel.ref,
        action: "skip",
        type: incRel.type,
        personARef: incRel.personARef,
        personBRef: incRel.personBRef,
        label: incRel.label,
        evidence: incRel.evidence,
        reason: "missing_reference",
      });
      continue;
    }

    if (incRel.personARef === incRel.personBRef) {
      mergedRelationships.push({
        ref: incRel.ref,
        action: "skip",
        type: incRel.type,
        personARef: incRel.personARef,
        personBRef: incRel.personBRef,
        label: incRel.label,
        evidence: incRel.evidence,
        reason: "self_reference",
      });
      continue;
    }

    // 检测重复
    const existingPersonAId = personA?.existingPersonId;
    const existingPersonBId = personB?.existingPersonId;
    const duplicate =
      existingPersonAId && existingPersonBId
        ? existingRelationships.some((existing) => {
            if (incRel.type === "spouse") {
              return (
                existing.type === "spouse" &&
                ((existing.personAId === existingPersonAId &&
                  existing.personBId === existingPersonBId) ||
                  (existing.personAId === existingPersonBId &&
                    existing.personBId === existingPersonAId))
              );
            }
            return (
              existing.type === "child" &&
              existing.personAId === existingPersonAId &&
              existing.personBId === existingPersonBId
            );
          })
        : false;

    mergedRelationships.push({
      ref: incRel.ref,
      action: duplicate ? "skip" : "create",
      type: incRel.type,
      personARef: incRel.personARef,
      personBRef: incRel.personBRef,
      label: incRel.label,
      evidence: incRel.evidence,
      reason: duplicate ? "duplicate_relationship" : null,
    });
  }

  // 保留未更新的原草稿关系
  for (const prev of previousDraft.relationships) {
    if (!updatedRelationshipRefs.has(prev.ref)) {
      mergedRelationships.push(prev);
    }
  }

  // --- 3. 处理歧义 ---
  const mergedAmbiguities: IntakeDraft["ambiguities"] = [];

  // 检查前轮歧义是否已解决
  for (const ambiguity of previousDraft.ambiguities) {
    const isResolved = (() => {
      switch (ambiguity.kind) {
        case "person_match": {
          // 如果关联的人物现在 action 变为 "reuse"，则已解决
          return ambiguity.relatedRefs.some((ref) => {
            const person = mergedPersons.find((p) => p.ref === ref);
            return person?.action === "reuse";
          });
        }
        case "person_gender_unknown": {
          // 如果关联的人物性别不再是 unknown，则已解决
          return ambiguity.relatedRefs.some((ref) => {
            const person = mergedPersons.find((p) => p.ref === ref);
            return person && person.gender !== "unknown";
          });
        }
        case "missing_reference": {
          // 如果关联的关系不再是 skip（reason 不是 missing_reference），则已解决
          return ambiguity.relatedRefs.some((ref) => {
            const rel = mergedRelationships.find((r) => r.ref === ref);
            return rel && !(rel.action === "skip" && rel.reason === "missing_reference");
          });
        }
        case "generation_unclear":
        case "relationship_direction_unknown": {
          // 如果关联的关系不再是 skip，则可能已解决
          return ambiguity.relatedRefs.some((ref) => {
            const rel = mergedRelationships.find((r) => r.ref === ref);
            return rel && rel.action !== "skip";
          });
        }
        case "duplicate_relationship": {
          // 重复关系通常不可通过澄清解决，保留
          return false;
        }
        default:
          return false;
      }
    })();

    if (!isResolved) {
      mergedAmbiguities.push(ambiguity);
    }
  }

  // 追加增量提取中的新歧义（转为字符串的转回来）
  for (const ambiguityText of incrementalExtraction.ambiguities) {
    // 避免重复添加相同的歧义文本
    const alreadyExists = mergedAmbiguities.some(
      (a) => a.message === ambiguityText,
    );
    if (!alreadyExists) {
      mergedAmbiguities.push({
        kind: "missing_reference", // 默认类型，LLM 的 ambiguities 是字符串数组
        message: ambiguityText,
        relatedRefs: [],
        options: [],
      });
    }
  }

  // --- 4. 构建合并结果 ---
  const mergedDraft = {
    summary: incrementalExtraction.summary || previousDraft.summary,
    persons: mergedPersons,
    relationships: mergedRelationships,
    ambiguities: mergedAmbiguities,
    questions: [
      ...previousDraft.questions,
      ...incrementalExtraction.questions.filter(
        (q) => !previousDraft.questions.includes(q),
      ),
    ],
    readyToApply: false, // 下面重新计算
  };

  // 重新计算 readyToApply
  mergedDraft.readyToApply =
    mergedDraft.ambiguities.length === 0 &&
    (mergedDraft.persons.length > 0 || mergedDraft.relationships.length > 0);

  return intakeDraftSchema.parse(mergedDraft);
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

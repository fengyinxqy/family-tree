import { createHash } from "node:crypto";
import { intakeDraftSchema } from "./schemas";
import type { IntakeDraft } from "./types";
import {
  createRevisionGroupSchema,
  type CreateRevisionGroupInput,
} from "@/lib/editorial/revision-groups";

export interface BuildIntakeRevisionGroupOptions {
  sourceText: string;
  conversationRounds?: number;
  capturedAt?: Date;
}

export interface StandaloneRelationshipRevision {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  label: string | null;
  sortOrder: number;
}

export function getStandaloneRelationshipRevision(
  group: CreateRevisionGroupInput,
): StandaloneRelationshipRevision | null {
  if (group.members.length !== 1) return null;
  const member = group.members[0];
  if (
    member?.contentType !== "RELATIONSHIP"
    || member.payload.personA.kind !== "EXISTING"
    || member.payload.personB.kind !== "EXISTING"
  ) return null;
  return {
    type: member.payload.type,
    personAId: member.payload.personA.entityId,
    personBId: member.payload.personB.entityId,
    label: member.payload.label,
    sortOrder: member.payload.sortOrder,
  };
}

export function buildIntakeRevisionGroup(
  draftInput: IntakeDraft,
  options: BuildIntakeRevisionGroupOptions,
): CreateRevisionGroupInput {
  const draft = intakeDraftSchema.parse(draftInput);
  if (!draft.readyToApply || draft.ambiguities.length > 0) {
    throw new Error("当前草稿仍有歧义，不能创建待审修订");
  }

  const sourceText = options.sourceText.trim();
  if (!sourceText) throw new Error("创建待审修订需要保留录入来源摘要");

  const personReferences = new Map<string, { kind: "EXISTING"; entityId: string } | { kind: "TEMPORARY"; tempRef: string }>();
  const members: CreateRevisionGroupInput["members"] = [];

  for (const person of draft.persons) {
    if (person.action === "reuse") {
      if (!person.existingPersonId) throw new Error(`人物 ${person.name} 缺少复用目标`);
      personReferences.set(person.ref, { kind: "EXISTING", entityId: person.existingPersonId });
      continue;
    }
    if (person.gender === "unknown") throw new Error(`人物 ${person.name} 的性别仍待确认`);

    const tempRef = `tmp:person-${members.length}`;
    personReferences.set(person.ref, { kind: "TEMPORARY", tempRef });
    members.push({
      contentType: "PERSON",
      order: members.length,
      tempRef,
      payload: {
        name: person.name,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        bio: person.bio,
        evidence: person.evidence,
      },
    });
  }

  for (const relationship of draft.relationships) {
    if (relationship.action !== "create") continue;
    const personA = personReferences.get(relationship.personARef);
    const personB = personReferences.get(relationship.personBRef);
    if (!personA || !personB) throw new Error(`关系 ${relationship.ref} 包含未定义的人物引用`);

    members.push({
      contentType: "RELATIONSHIP",
      order: members.length,
      tempRef: `tmp:relationship-${members.length}`,
      payload: {
        type: relationship.type,
        personA,
        personB,
        label: relationship.label,
        sortOrder: 0,
        evidence: relationship.evidence,
      },
    });
  }

  return createRevisionGroupSchema.parse({
    schemaVersion: 1,
    summary: draft.summary,
    source: {
      schemaVersion: 1,
      sourceTextHash: createHash("sha256").update(sourceText, "utf8").digest("hex"),
      safeExcerpt: sourceText.replace(/\s+/g, " ").slice(0, 500),
      conversationRounds: options.conversationRounds ?? 1,
      capturedAt: (options.capturedAt ?? new Date()).toISOString(),
    },
    members,
  });
}

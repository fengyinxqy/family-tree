import { z } from "zod";
import { familyBackupSchema } from "@/lib/import-export/backup-format";
import { familyExchangeManifestSchema } from "@/lib/import-export/exchange-package";

export const REVISION_GROUP_STATUSES = ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"] as const;
export type RevisionGroupStatus = (typeof REVISION_GROUP_STATUSES)[number];

const entityId = z.string().trim().min(1).max(191);
const temporaryRef = z.string().trim().regex(/^tmp:[a-zA-Z0-9_-]{1,120}$/);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);

export const revisionGroupEntityReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EXISTING"), entityId }),
  z.object({ kind: z.literal("TEMPORARY"), tempRef: temporaryRef }),
]);

export const intakeSourceSnapshotSchema = z.object({
  kind: z.literal("INTAKE_SNAPSHOT").optional().default("INTAKE_SNAPSHOT"),
  schemaVersion: z.literal(1),
  sourceTextHash: z.string().regex(/^[a-f0-9]{64}$/i),
  safeExcerpt: z.string().trim().max(500),
  conversationRounds: z.number().int().min(0).max(5),
  capturedAt: z.string().datetime(),
});

export const importSourceSnapshotSchema = z.object({
  kind: z.literal("FAMILY_IMPORT"),
  format: z.enum(["JSON", "EXCHANGE"]),
  sourceTextHash: z.string().regex(/^[a-f0-9]{64}$/i),
  safeExcerpt: z.string().trim().min(1).max(500),
  capturedAt: z.string().datetime(),
  document: z.union([familyBackupSchema, familyExchangeManifestSchema]),
  storedFiles: z.record(z.string().min(1), z.string().min(1)).default({}),
}).superRefine((value, context) => {
  if (value.format === "JSON" && value.document.kind !== "family-backup") {
    context.addIssue({ code: "custom", message: "JSON 导入来源格式不匹配", path: ["document"] });
  }
  if (value.format === "EXCHANGE" && value.document.kind !== "family-exchange-package") {
    context.addIssue({ code: "custom", message: "交换包导入来源格式不匹配", path: ["document"] });
  }
  if (value.document.kind === "family-exchange-package") {
    const fileIds = new Set(value.document.files.map((file) => file.id));
    if (fileIds.size !== Object.keys(value.storedFiles).length || [...fileIds].some((id) => !value.storedFiles[id])) {
      context.addIssue({ code: "custom", message: "交换包私有文件不完整", path: ["storedFiles"] });
    }
  }
});

export const revisionGroupSourceSnapshotSchema = z.union([
  intakeSourceSnapshotSchema,
  importSourceSnapshotSchema,
]);

const groupPersonMemberSchema = z.object({
  contentType: z.literal("PERSON"),
  order: z.number().int().min(0),
  tempRef: temporaryRef,
  payload: z.object({
    name: z.string().trim().min(1).max(120),
    gender: z.enum(["male", "female"]),
    birthDate: optionalText(32),
    deathDate: optionalText(32),
    bio: optionalText(5000),
    evidence: z.string().trim().min(1).max(2000),
  }),
});

const groupPersonEventMemberSchema = z.object({
  contentType: z.literal("PERSON_EVENT"),
  order: z.number().int().min(0),
  tempRef: temporaryRef,
  payload: z.object({
    person: revisionGroupEntityReferenceSchema,
    type: z.enum(["birth", "death", "marriage", "migration", "other"]),
    title: optionalText(200),
    dateLabel: optionalText(32),
    location: optionalText(200),
    description: optionalText(3000),
    sortOrder: z.number().int().min(0).default(0),
    evidence: z.string().trim().min(1).max(2000),
  }),
});

const groupRelationshipMemberSchema = z.object({
  contentType: z.literal("RELATIONSHIP"),
  order: z.number().int().min(0),
  tempRef: temporaryRef,
  payload: z.object({
    type: z.enum(["spouse", "child"]),
    personA: revisionGroupEntityReferenceSchema,
    personB: revisionGroupEntityReferenceSchema,
    label: optionalText(120),
    sortOrder: z.number().int().min(0).default(0),
    evidence: z.string().trim().min(1).max(2000),
  }),
});

export const revisionGroupMemberSchema = z.discriminatedUnion("contentType", [
  groupPersonMemberSchema,
  groupPersonEventMemberSchema,
  groupRelationshipMemberSchema,
]);

export const createRevisionGroupSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(1000),
  source: revisionGroupSourceSnapshotSchema,
  members: z.array(revisionGroupMemberSchema).max(200),
}).superRefine((value, context) => {
  if (value.source.kind === "INTAKE_SNAPSHOT" && value.members.length === 0) {
    context.addIssue({ code: "custom", message: "录入修订组至少需要一个成员", path: ["members"] });
  }
  if (value.source.kind === "FAMILY_IMPORT" && value.members.length !== 0) {
    context.addIssue({ code: "custom", message: "导入修订组的数据必须保存在不可变来源快照中", path: ["members"] });
  }
  const temporaryRefs = new Set<string>();
  const orders = new Set<number>();
  for (const member of value.members) {
    if (temporaryRefs.has(member.tempRef)) {
      context.addIssue({ code: "custom", message: "修订组临时引用不能重复", path: ["members"] });
    }
    if (orders.has(member.order)) {
      context.addIssue({ code: "custom", message: "修订组成员顺序不能重复", path: ["members"] });
    }
    temporaryRefs.add(member.tempRef);
    orders.add(member.order);
  }

  const referencedTemporaryRefs: string[] = [];
  for (const member of value.members) {
    if (member.contentType === "PERSON_EVENT" && member.payload.person.kind === "TEMPORARY") {
      referencedTemporaryRefs.push(member.payload.person.tempRef);
    }
    if (member.contentType === "RELATIONSHIP") {
      if (member.payload.personA.kind === "TEMPORARY") referencedTemporaryRefs.push(member.payload.personA.tempRef);
      if (member.payload.personB.kind === "TEMPORARY") referencedTemporaryRefs.push(member.payload.personB.tempRef);
    }
  }
  if (referencedTemporaryRefs.some((reference) => !temporaryRefs.has(reference))) {
    context.addIssue({ code: "custom", message: "修订组包含未定义的临时引用", path: ["members"] });
  }
});

const ALLOWED_GROUP_TRANSITIONS: Readonly<Record<RevisionGroupStatus, readonly RevisionGroupStatus[]>> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: [],
  APPROVED: ["PUBLISHED"],
  PUBLISHED: [],
};

export function assertRevisionGroupTransition(from: RevisionGroupStatus, to: RevisionGroupStatus) {
  if (!ALLOWED_GROUP_TRANSITIONS[from].includes(to)) throw new Error(`不允许修订组从 ${from} 变更为 ${to}`);
}

export type CreateRevisionGroupInput = z.infer<typeof createRevisionGroupSchema>;
export type RevisionGroupMemberInput = z.infer<typeof revisionGroupMemberSchema>;

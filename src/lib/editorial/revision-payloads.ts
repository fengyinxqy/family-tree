import { z } from "zod";

export const REVISION_CONTENT_TYPES = [
  "PERSON",
  "PERSON_EVENT",
  "RELATIONSHIP",
  "SOURCE_MATERIAL",
  "MEDIA_OBJECT",
  "MATERIAL_LINK",
  "IMPORT_BATCH",
] as const;

export type RevisionContentType = (typeof REVISION_CONTENT_TYPES)[number];

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const entityId = z.string().trim().min(1);

export const personRevisionPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gender: z.enum(["male", "female"]),
  birthDate: optionalText(32),
  deathDate: optionalText(32),
  bio: optionalText(5000),
  aliases: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  generationNumber: z.number().int().min(1).max(999),
  generationLabel: optionalText(80),
  nativePlace: optionalText(200),
  notes: optionalText(5000),
  posX: z.number().finite().nullable().optional().default(null),
  posY: z.number().finite().nullable().optional().default(null),
  events: z.array(z.object({
    type: z.enum(["birth", "death", "marriage", "migration", "other"]),
    title: optionalText(200),
    dateLabel: optionalText(32),
    location: optionalText(200),
    description: optionalText(3000),
    sortOrder: z.number().int().min(0).default(0),
  })).max(500).default([]),
});

export const personEventRevisionPayloadSchema = z.object({
  personId: entityId,
  type: z.enum(["birth", "death", "marriage", "migration", "other"]),
  title: optionalText(200),
  dateLabel: optionalText(32),
  location: optionalText(200),
  description: optionalText(3000),
  sortOrder: z.number().int().min(0).default(0),
});

export const relationshipRevisionPayloadSchema = z.object({
  type: z.enum(["spouse", "child"]),
  personAId: entityId,
  personBId: entityId,
  label: optionalText(120),
  sortOrder: z.number().int().min(0).default(0),
}).superRefine((value, context) => {
  if (value.personAId === value.personBId) context.addIssue({ code: "custom", message: "关系两端不能是同一人物", path: ["personBId"] });
});

export const sourceMaterialRevisionPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(["genealogy", "document", "photo", "certificate", "oral_history", "other"]),
  source: optionalText(200),
  eraLabel: optionalText(80),
  contributor: optionalText(120),
  description: optionalText(2000),
});

export const mediaObjectRevisionPayloadSchema = z.object({
  materialId: entityId,
  stagedObjectId: entityId,
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  displayOrder: z.number().int().min(0).default(0),
});

const materialLinkTargetSchema = z.object({
  personId: entityId.nullable().optional().default(null),
  personEventId: entityId.nullable().optional().default(null),
}).superRefine((value, context) => {
  if (Number(Boolean(value.personId)) + Number(Boolean(value.personEventId)) !== 1) {
    context.addIssue({ code: "custom", message: "资料关联必须且只能指定一个目标" });
  }
});

export const materialLinkRevisionPayloadSchema = z.object({
  materialId: entityId,
  targets: z.array(materialLinkTargetSchema).max(1000),
}).superRefine((value, context) => {
  const keys = value.targets.map((target) => target.personId ? `person:${target.personId}` : `event:${target.personEventId}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "资料关联目标不能重复", path: ["targets"] });
});

export const importBatchRevisionPayloadSchema = z.object({
  packageHash: z.string().trim().min(16).max(128),
  stagedPackageId: entityId,
  summary: z.object({
    personCount: z.number().int().min(0),
    relationshipCount: z.number().int().min(0),
    eventCount: z.number().int().min(0),
    materialCount: z.number().int().min(0),
    fileCount: z.number().int().min(0),
  }),
});

const PAYLOAD_SCHEMAS = {
  PERSON: personRevisionPayloadSchema,
  PERSON_EVENT: personEventRevisionPayloadSchema,
  RELATIONSHIP: relationshipRevisionPayloadSchema,
  SOURCE_MATERIAL: sourceMaterialRevisionPayloadSchema,
  MEDIA_OBJECT: mediaObjectRevisionPayloadSchema,
  MATERIAL_LINK: materialLinkRevisionPayloadSchema,
  IMPORT_BATCH: importBatchRevisionPayloadSchema,
} as const;

export class RevisionPayloadError extends Error {
  constructor(public readonly code: "UNSUPPORTED_SCHEMA" | "INVALID_PAYLOAD" | "OUT_OF_SCOPE_REFERENCE", message: string) {
    super(message);
    this.name = "RevisionPayloadError";
  }
}

export function parseRevisionPayload(contentType: RevisionContentType, schemaVersion: number, payload: unknown) {
  if (schemaVersion !== 1 || !PAYLOAD_SCHEMAS[contentType]) {
    throw new RevisionPayloadError("UNSUPPORTED_SCHEMA", "不支持的修订内容类型或 schema 版本");
  }
  const result = PAYLOAD_SCHEMAS[contentType].safeParse(payload);
  if (!result.success) {
    throw new RevisionPayloadError("INVALID_PAYLOAD", result.error.issues[0]?.message ?? "修订内容无效");
  }
  return result.data;
}

type ReferenceType = "person" | "person_event" | "source_material";

export interface RevisionScopeRepository {
  entityBelongsToTree(type: ReferenceType, id: string, treeId: string): Promise<boolean>;
}

function collectReferences(contentType: RevisionContentType, payload: ReturnType<typeof parseRevisionPayload>) {
  const references: Array<{ type: ReferenceType; id: string }> = [];
  if (contentType === "PERSON_EVENT") references.push({ type: "person", id: (payload as z.infer<typeof personEventRevisionPayloadSchema>).personId });
  if (contentType === "RELATIONSHIP") {
    const relationship = payload as z.infer<typeof relationshipRevisionPayloadSchema>;
    references.push({ type: "person", id: relationship.personAId }, { type: "person", id: relationship.personBId });
  }
  if (contentType === "MEDIA_OBJECT") references.push({ type: "source_material", id: (payload as z.infer<typeof mediaObjectRevisionPayloadSchema>).materialId });
  if (contentType === "MATERIAL_LINK") {
    const link = payload as z.infer<typeof materialLinkRevisionPayloadSchema>;
    references.push({ type: "source_material", id: link.materialId });
    for (const target of link.targets) {
      if (target.personId) references.push({ type: "person", id: target.personId });
      if (target.personEventId) references.push({ type: "person_event", id: target.personEventId });
    }
  }
  return references;
}

export async function validateRevisionPayloadScope(
  repository: RevisionScopeRepository,
  treeId: string,
  contentType: RevisionContentType,
  schemaVersion: number,
  payloadInput: unknown,
) {
  const payload = parseRevisionPayload(contentType, schemaVersion, payloadInput);
  const references = collectReferences(contentType, payload);
  const results = await Promise.all(references.map((reference) => repository.entityBelongsToTree(reference.type, reference.id, treeId)));
  if (results.some((belongs) => !belongs)) {
    throw new RevisionPayloadError("OUT_OF_SCOPE_REFERENCE", "修订引用的记录不存在或不属于当前家族");
  }
  return payload;
}

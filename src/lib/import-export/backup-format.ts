import { z } from "zod";

export const FAMILY_BACKUP_KIND = "family-backup";
export const FAMILY_BACKUP_VERSION = 1;

const isoDateString = z.string().datetime();

export const backupPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(["male", "female"]),
  birthDate: z.string().nullable(),
  deathDate: z.string().nullable(),
  bio: z.string().nullable(),
  aliases: z.array(z.string()),
  generationLabel: z.string().nullable(),
  nativePlace: z.string().nullable(),
  notes: z.string().nullable(),
  posX: z.number().nullable(),
  posY: z.number().nullable(),
  createdAt: isoDateString,
});

export const backupRelationshipSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["spouse", "child"]),
  personAId: z.string().min(1),
  personBId: z.string().min(1),
  label: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoDateString,
});

export const backupEventSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  type: z.enum(["birth", "death", "marriage", "migration", "other"]),
  title: z.string().nullable(),
  dateLabel: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoDateString,
});

export const familyBackupSchema = z.object({
  kind: z.literal(FAMILY_BACKUP_KIND),
  version: z.number().int(),
  exportedAt: isoDateString,
  summary: z.object({
    personCount: z.number().int().nonnegative(),
    relationshipCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
  }),
  persons: z.array(backupPersonSchema),
  relationships: z.array(backupRelationshipSchema),
  events: z.array(backupEventSchema),
});

export type BackupPerson = z.infer<typeof backupPersonSchema>;
export type BackupRelationship = z.infer<typeof backupRelationshipSchema>;
export type BackupEvent = z.infer<typeof backupEventSchema>;
export type FamilyBackupDocument = z.infer<typeof familyBackupSchema>;

export function buildFamilyBackupDocument(input: {
  exportedAt?: string;
  persons: BackupPerson[];
  relationships: BackupRelationship[];
  events: BackupEvent[];
}): FamilyBackupDocument {
  return {
    kind: FAMILY_BACKUP_KIND,
    version: FAMILY_BACKUP_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    summary: {
      personCount: input.persons.length,
      relationshipCount: input.relationships.length,
      eventCount: input.events.length,
    },
    persons: input.persons,
    relationships: input.relationships,
    events: input.events,
  };
}

function assertUniqueIds(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`备份文件中存在重复的${label} ID`);
    }
    seen.add(value);
  }
}

export function validateFamilyBackupDocument(input: unknown): FamilyBackupDocument {
  const parsed = familyBackupSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("备份文件格式无效");
  }

  const document = parsed.data;

  if (document.version !== FAMILY_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${document.version}`);
  }

  assertUniqueIds(
    document.persons.map((person) => person.id),
    "人物",
  );
  assertUniqueIds(
    document.relationships.map((relationship) => relationship.id),
    "关系",
  );
  assertUniqueIds(
    document.events.map((event) => event.id),
    "事件",
  );

  const personIds = new Set(document.persons.map((person) => person.id));
  for (const relationship of document.relationships) {
    if (!personIds.has(relationship.personAId) || !personIds.has(relationship.personBId)) {
      throw new Error("备份文件中的关系引用了不存在的人物");
    }
  }

  for (const event of document.events) {
    if (!personIds.has(event.personId)) {
      throw new Error("备份文件中的事件引用了不存在的人物");
    }
  }

  return document;
}

export function buildRestorePayloads(
  document: FamilyBackupDocument,
  personIdMap: Map<string, string>,
) {
  return {
    relationships: document.relationships.map((relationship) => ({
      type: relationship.type,
      personAId: personIdMap.get(relationship.personAId)!,
      personBId: personIdMap.get(relationship.personBId)!,
      label: relationship.label,
      sortOrder: relationship.sortOrder,
      createdAt: new Date(relationship.createdAt),
    })),
    events: document.events.map((event) => ({
      personId: personIdMap.get(event.personId)!,
      type: event.type,
      title: event.title,
      dateLabel: event.dateLabel,
      location: event.location,
      description: event.description,
      sortOrder: event.sortOrder,
      createdAt: new Date(event.createdAt),
    })),
  };
}

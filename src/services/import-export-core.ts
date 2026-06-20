import {
  buildFamilyBackupDocument,
  buildRestorePayloads,
  validateFamilyBackupDocument,
  type FamilyBackupDocument,
  type BackupPerson,
  type BackupRelationship,
  type BackupEvent,
} from "@/lib/import-export/backup-format";

type PersonRecord = {
  id: string;
  name: string;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  aliases: string[];
  generationNumber: number;
  generationLabel: string | null;
  nativePlace: string | null;
  notes: string | null;
  posX: number | null;
  posY: number | null;
  createdAt: Date;
};

type RelationshipRecord = {
  id: string;
  type: string;
  personAId: string;
  personBId: string;
  label: string | null;
  sortOrder: number;
  createdAt: Date;
};

type PersonEventRecord = {
  id: string;
  personId: string;
  type: string;
  title: string | null;
  dateLabel: string | null;
  location: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
};

type TransactionClient = {
  relationship: {
    deleteMany(args: { where: { personA: { treeId: string } } }): Promise<unknown>;
    createMany(args: {
      data: Array<{
        type: "spouse" | "child";
        personAId: string;
        personBId: string;
        label: string | null;
        sortOrder: number;
        createdAt: Date;
      }>;
    }): Promise<unknown>;
  };
  personEvent: {
    deleteMany(args: { where: { person: { treeId: string } } }): Promise<unknown>;
    createMany(args: {
      data: Array<{
        personId: string;
        type: "birth" | "death" | "marriage" | "migration" | "other";
        title: string | null;
        dateLabel: string | null;
        location: string | null;
        description: string | null;
        sortOrder: number;
        createdAt: Date;
      }>;
    }): Promise<unknown>;
  };
  person: {
    deleteMany(args: { where: { treeId: string } }): Promise<unknown>;
    create(args: {
      data: {
        name: string;
        gender: "male" | "female";
        birthDate: string | null;
        deathDate: string | null;
        bio: string | null;
        aliases: string[];
        generationNumber: number;
        generationLabel: string | null;
        nativePlace: string | null;
        notes: string | null;
        posX: number | null;
        posY: number | null;
        createdAt: Date;
        createdBy: string;
        treeId: string;
      };
    }): Promise<{ id: string }>;
  };
};

type PrismaLike = {
  person: {
    findMany(args: {
      where: { treeId: string; deletedAt: null };
      orderBy: Array<{ createdAt: "asc" } | { id: "asc" }>;
    }): Promise<PersonRecord[]>;
  };
  relationship: {
    findMany(args: {
      where: { personA: { treeId: string; deletedAt: null }; deletedAt: null };
      orderBy: Array<{ sortOrder: "asc" } | { createdAt: "asc" } | { id: "asc" }>;
    }): Promise<RelationshipRecord[]>;
  };
  personEvent: {
    findMany(args: {
      where: { person: { treeId: string; deletedAt: null } };
      orderBy: Array<
        { personId: "asc" } | { sortOrder: "asc" } | { createdAt: "asc" } | { id: "asc" }
      >;
    }): Promise<PersonEventRecord[]>;
  };
  $transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
};

export function createImportExportService(deps: {
  prisma: PrismaLike;
  revalidatePath: (path: string) => void;
}) {
  async function exportFamilyBackupForUser(userId: string, treeId: string): Promise<FamilyBackupDocument> {
    // 仅导出活跃业务记录，排除软删除、审计、确认和快照数据
    const [persons, relationships, events] = await Promise.all([
      deps.prisma.person.findMany({
        where: { treeId, deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      deps.prisma.relationship.findMany({
        where: { personA: { treeId, deletedAt: null }, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      deps.prisma.personEvent.findMany({
        where: { person: { treeId, deletedAt: null } },
        orderBy: [{ personId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    return buildFamilyBackupDocument({
      persons: persons.map((person) => ({
        id: person.id,
        name: person.name,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        bio: person.bio,
        aliases: person.aliases ?? [],
        generationNumber: person.generationNumber,
        generationLabel: person.generationLabel,
        nativePlace: person.nativePlace,
        notes: person.notes,
        posX: person.posX,
        posY: person.posY,
        createdAt: person.createdAt.toISOString(),
      })) as BackupPerson[],
      relationships: relationships.map((relationship) => ({
        id: relationship.id,
        type: relationship.type,
        personAId: relationship.personAId,
        personBId: relationship.personBId,
        label: relationship.label,
        sortOrder: relationship.sortOrder,
        createdAt: relationship.createdAt.toISOString(),
      })) as BackupRelationship[],
      events: events.map((event) => ({
        id: event.id,
        personId: event.personId,
        type: event.type,
        title: event.title,
        dateLabel: event.dateLabel,
        location: event.location,
        description: event.description,
        sortOrder: event.sortOrder,
        createdAt: event.createdAt.toISOString(),
      })) as BackupEvent[],
    });
  }

  async function importFamilyBackupForUser(userId: string, treeId: string, input: unknown) {
    const document = validateFamilyBackupDocument(input);

    const summary = await deps.prisma.$transaction(async (tx) => {
      // 清空活跃数据（导入为原子替换操作）
      await tx.relationship.deleteMany({
        where: { personA: { treeId } },
      });
      await tx.personEvent.deleteMany({
        where: { person: { treeId } },
      });
      await tx.person.deleteMany({
        where: { treeId },
      });

      const personIdMap = new Map<string, string>();

      for (const person of document.persons) {
        const created = await tx.person.create({
          data: {
            name: person.name,
            gender: person.gender,
            birthDate: person.birthDate,
            deathDate: person.deathDate,
            bio: person.bio,
            aliases: person.aliases,
            generationNumber: person.generationNumber,
            generationLabel: person.generationLabel,
            nativePlace: person.nativePlace,
            notes: person.notes,
            posX: person.posX,
            posY: person.posY,
            createdAt: new Date(person.createdAt),
            createdBy: userId,
            treeId,
          },
        });

        personIdMap.set(person.id, created.id);
      }

      const restorePayloads = buildRestorePayloads(document, personIdMap);

      if (restorePayloads.relationships.length > 0) {
        await tx.relationship.createMany({
          data: restorePayloads.relationships,
        });
      }

      if (restorePayloads.events.length > 0) {
        await tx.personEvent.createMany({
          data: restorePayloads.events,
        });
      }

      return {
        personCount: document.persons.length,
        relationshipCount: document.relationships.length,
        eventCount: document.events.length,
      };
    });

    deps.revalidatePath("/tree");
    return summary;
  }

  return {
    exportFamilyBackupForUser,
    importFamilyBackupForUser,
  };
}

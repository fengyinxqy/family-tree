"use server";

import { auth } from "@/lib/auth";
import { deriveSiblingRelations, type DerivedSiblingRelation } from "@/lib/relationships/derived-siblings";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import type { PersonEventData } from "@/types";


import {
  activePersonInTree,
  createAuditBatch,
  createConfirmation,
  consumeConfirmation,
  getTreeRevision,
  getDeletionBatches,
} from "@/lib/data-safety";
import { validateRelationshipCandidate } from "@/lib/integrity";
export interface PersonEventInput {
  type: "birth" | "marriage" | "migration" | "other";
  title?: string | null;
  dateLabel?: string | null;
  location?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface CreatePersonInput {
  name: string;
  gender: string;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  aliases?: string[];
  generationNumber?: number;
  generationLabel?: string | null;
  nativePlace?: string | null;
  notes?: string | null;
  events?: PersonEventInput[];
}

export interface UpdatePersonInput {
  name?: string;
  gender?: string;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  aliases?: string[];
  generationNumber?: number;
  generationLabel?: string | null;
  nativePlace?: string | null;
  notes?: string | null;
  events?: PersonEventInput[];
}

export type PersonSiblingData = DerivedSiblingRelation;

export interface PersonDetailResult {
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
  updatedAt: Date;
  createdBy: string;
  treeId: string;
  events: PersonEventData[];
  siblings: PersonSiblingData[];
  relatedMaterials: Array<{
    id: string;
    title: string;
    category: string;
    eraLabel: string | null;
    contributor: string | null;
    fileCount: number;
  }>;
  relationsA: Array<{
    id: string;
    type: string;
    label: string | null;
    sortOrder: number;
    personB: {
      id: string;
      name: string;
      gender: string;
      birthDate: string | null;
      deathDate: string | null;
    };
  }>;
  relationsB: Array<{
    id: string;
    type: string;
    label: string | null;
    sortOrder: number;
    personA: {
      id: string;
      name: string;
      gender: string;
      birthDate: string | null;
      deathDate: string | null;
    };
  }>;
}

const DATE_LABEL_RE = /^(\d{4}(-\d{2}(-\d{2})?)?)?$/;

function validateEvents(events: PersonEventInput[]): void {
  const birthCount = events.filter((event) => event.type === "birth").length;
  if (birthCount > 1) {
    throw new Error("出生事件只能有一个");
  }

  for (const event of events) {
    if (event.dateLabel && !DATE_LABEL_RE.test(event.dateLabel)) {
      throw new Error(`事件日期格式无效: "${event.dateLabel}"，请使用 YYYY、YYYY-MM 或 YYYY-MM-DD`);
    }
  }
}

export async function getPersons() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, activeTree.id, "family.read.published");
  return prisma.person.findMany({
    where: { treeId: activeTree.id, deletedAt: null, withdrawnAt: null },
    include: { events: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

async function getDerivedSiblings(
  personId: string,
  personGender: string,
  relationsB: PersonDetailResult["relationsB"],
) {
  const parentIds = [...new Set(relationsB.filter((relation) => relation.type === "child").map((relation) => relation.personA.id))];

  if (parentIds.length === 0) {
    return [];
  }

  const siblingRelations = await prisma.relationship.findMany({
    where: {
      type: "child",
      personAId: { in: parentIds },
      NOT: { personBId: personId },
    },
    include: {
      personA: {
        select: {
          id: true,
          name: true,
        },
      },
      personB: {
        select: {
          id: true,
          name: true,
          gender: true,
        },
      },
    },
    orderBy: [{ personAId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return deriveSiblingRelations(
    personId,
    personGender,
    siblingRelations.map((relation) => ({
      parentId: relation.personA.id,
      parentName: relation.personA.name,
      sibling: {
        id: relation.personB.id,
        name: relation.personB.name,
        gender: relation.personB.gender,
      },
    })),
  );
}

export async function getPerson(id: string): Promise<PersonDetailResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, activeTree.id, "family.read.published");
  const person = await prisma.person.findFirst({
    where: { id, treeId: activeTree.id, deletedAt: null, withdrawnAt: null },
    include: {
      events: { where: { withdrawnAt: null }, orderBy: { sortOrder: "asc" } },
      relationsA: {
        where: { deletedAt: null, withdrawnAt: null, personB: { deletedAt: null, withdrawnAt: null } },
        include: {
          personB: {
            select: { id: true, name: true, gender: true, birthDate: true, deathDate: true },
          },
        },
      },
      relationsB: {
        where: { deletedAt: null, withdrawnAt: null, personA: { deletedAt: null, withdrawnAt: null } },
        include: {
          personA: {
            select: { id: true, name: true, gender: true, birthDate: true, deathDate: true },
          },
        },
      },
    },
  });

  if (!person) {
    throw new Error("人物不存在");
  }

  const siblings = await getDerivedSiblings(id, person.gender, person.relationsB as PersonDetailResult["relationsB"]);
  const materialLinks = await prisma.materialLink.findMany({
    where: {
      personId: id,
      deletedAt: null,
      withdrawnAt: null,
      material: { deletedAt: null, withdrawnAt: null, treeId: person.treeId },
    },
    include: {
      material: {
        include: { _count: { select: { files: { where: { deletedAt: null, withdrawnAt: null } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...(person as unknown as Omit<PersonDetailResult, "siblings" | "relatedMaterials">),
    siblings,
    relatedMaterials: materialLinks.map((link) => ({
      id: link.material.id,
      title: link.material.title,
      category: link.material.category,
      eraLabel: link.material.eraLabel,
      contributor: link.material.contributor,
      fileCount: link.material._count.files,
    })),
  };
}

export async function createPerson(input: CreatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const userId = session.user.id;
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user.name);
  await authorizeFamilyAction(userId, activeTree.id, "content.edit.direct");

  if (input.events) {
    validateEvents(input.events);
  }

  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate ?? null,
        deathDate: input.deathDate ?? null,
        bio: input.bio ?? null,
        aliases: input.aliases ?? [],
        generationNumber: input.generationNumber ?? 1,
        generationLabel: input.generationLabel ?? null,
        nativePlace: input.nativePlace ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
        treeId: activeTree.id,
      },
    });

    if (input.events && input.events.length > 0) {
      await tx.personEvent.createMany({
        data: input.events.map((event, index) => ({
          personId: created.id,
          type: event.type,
          title: event.title ?? null,
          dateLabel: event.dateLabel ?? null,
          location: event.location ?? null,
          description: event.description ?? null,
          sortOrder: event.sortOrder ?? index,
        })),
      });
    }

    return created;
  });

  revalidatePath("/tree");
  return person;
}

export async function updatePerson(id: string, input: UpdatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, activeTree.id, "content.edit.direct");
  const existing = await prisma.person.findFirst({ where: { id, treeId: activeTree.id, deletedAt: null } });
  if (!existing) {
    throw new Error("无权操作");
  }

  if (input.events) {
    validateEvents(input.events);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { id },
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate,
        deathDate: input.deathDate,
        bio: input.bio,
        aliases: input.aliases,
        generationNumber: input.generationNumber,
        generationLabel: input.generationLabel,
        nativePlace: input.nativePlace,
        notes: input.notes,
      },
    });

    if (input.events !== undefined) {
      await tx.personEvent.deleteMany({ where: { personId: id } });
      if (input.events.length > 0) {
        await tx.personEvent.createMany({
          data: input.events.map((event, index) => ({
            personId: id,
            type: event.type,
            title: event.title ?? null,
            dateLabel: event.dateLabel ?? null,
            location: event.location ?? null,
            description: event.description ?? null,
            sortOrder: event.sortOrder ?? index,
          })),
        });
      }
    }

    return person;
  });

  revalidatePath("/tree");
  revalidatePath(`/person/${id}`);
  return updated;
}

/**
 * 人物删除影响预览
 */
export async function previewPersonDeletion(personId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  await authorizeFamilyAction(userId, activeTree.id, "content.delete");

  const person = await prisma.person.findUnique({
    where: { id: personId, deletedAt: null },
  });

  if (!person || person.treeId !== activeTree.id) {
    throw new Error("无权操作");
  }

  const [activeRelationships, events] = await Promise.all([
    prisma.relationship.findMany({
      where: {
        deletedAt: null,
        OR: [{ personAId: personId }, { personBId: personId }],
      },
      include: {
        personA: { select: { id: true, name: true } },
        personB: { select: { id: true, name: true } },
      },
    }),
    prisma.personEvent.findMany({
      where: { personId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const revision = await getTreeRevision(prisma, activeTree.id);

  const preview = {
    person: { id: person.id, name: person.name },
    affected: {
      relationshipCount: activeRelationships.length,
      eventCount: events.length,
      relationships: activeRelationships.map((r) => ({
        id: r.id,
        type: r.type,
        otherPerson:
          r.personAId === personId
            ? { id: r.personB.id, name: r.personB.name }
            : { id: r.personA.id, name: r.personA.name },
      })),
      events: events.map((e) => ({ id: e.id, type: e.type, title: e.title })),
    },
    revision,
  };

  const confirmationId = await createConfirmation(prisma, {
    treeId: activeTree.id,
    userId,
    kind: "person_delete",
    input: { personId },
    revision,
    previewResult: preview as Record<string, unknown>,
  });

  return { preview, confirmationId };
}

/**
 * 确认人物软删除
 */
export async function deletePerson(confirmationId: string, personId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  await authorizeFamilyAction(userId, activeTree.id, "content.delete");

  await prisma.$transaction(async (tx) => {
    const currentRevision = await getTreeRevision(tx, activeTree.id);
    await consumeConfirmation(tx, {
      confirmationId,
      treeId: activeTree.id,
      userId,
      kind: "person_delete",
      input: { personId },
      currentRevision,
    });

    const person = await tx.person.findUnique({
      where: { id: personId, deletedAt: null },
    });

    if (!person || person.treeId !== activeTree.id) {
      throw new Error("无权操作");
    }

    const relationships = await tx.relationship.findMany({
      where: {
        deletedAt: null,
        OR: [{ personAId: personId }, { personBId: personId }],
      },
    });

    const now = new Date();

    const batch = await createAuditBatch(tx, {
      treeId: activeTree.id,
      actorId: userId,
      action: "person_delete",
      summary: { description: "删除人物：" + person.name + "，连带" + relationships.length + "条关系", personId, personName: person.name, relationshipCount: relationships.length },
      entries: [
        {
          entityType: "person",
          entityId: personId,
          action: "delete",
          beforeJson: { name: person.name, gender: person.gender },
        },
        ...relationships.map((r) => ({
          entityType: "relationship" as const,
          entityId: r.id,
          action: "delete" as const,
          beforeJson: { type: r.type, personAId: r.personAId, personBId: r.personBId },
        })),
      ],
    });

    await tx.person.update({
      where: { id: personId },
      data: {
        deletedAt: now,
        deletedBy: userId,
        deletionOperationId: batch.batchId,
      },
    });

    for (const rel of relationships) {
      await tx.relationship.update({
        where: { id: rel.id },
        data: {
          deletedAt: now,
          deletedBy: userId,
          deletionOperationId: batch.batchId,
        },
      });
    }
  });

  revalidatePath("/tree");
}

/**
 * 获取可恢复的删除批次
 */
export async function getRecoverableDeletionBatches() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  await authorizeFamilyAction(userId, activeTree.id, "recovery.read");
  return getDeletionBatches(prisma, activeTree.id);
}

/**
 * 恢复删除批次中的人物和关系
 */
export async function restoreDeletionBatch(batchId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  await authorizeFamilyAction(userId, activeTree.id, "recovery.manage");

  await prisma.$transaction(async (tx) => {
    const batch = await tx.operationBatch.findUnique({
      where: { id: batchId },
      include: { entries: true },
    });

    if (!batch || batch.treeId !== activeTree.id || batch.status !== "complete") {
      throw new Error("批次不存在或不可恢复");
    }

    const personEntries = batch.entries.filter((e) => e.entityType === "person");
    for (const entry of personEntries) {
      const person = await tx.person.findUnique({ where: { id: entry.entityId } });
      if (!person || person.treeId !== activeTree.id) {
        throw new Error("批次不属于当前家谱");
      }
    }

    const treePersons = await tx.person.findMany({
      where: activePersonInTree(activeTree.id),
      select: { id: true },
    });
    const activePersonIds = new Set(treePersons.map((p) => p.id));

    // 将被恢复的人物也加入活跃集合，否则关系校验会因端点"不在活跃集合"而失败
    for (const entry of personEntries) {
      activePersonIds.add(entry.entityId);
    }

    const activeRelationships = await tx.relationship.findMany({
      where: {
        deletedAt: null,
        personA: { deletedAt: null, treeId: activeTree.id },
        personB: { deletedAt: null, treeId: activeTree.id },
      },
      select: { type: true, personAId: true, personBId: true },
    });

    const relEntries = batch.entries.filter((e) => e.entityType === "relationship");
    for (const entry of relEntries) {
      const beforeJson = entry.beforeJson as { type: string; personAId: string; personBId: string } | null;
      if (!beforeJson) continue;

      const validationResult = validateRelationshipCandidate(
        {
          type: beforeJson.type as "spouse" | "child",
          personAId: beforeJson.personAId,
          personBId: beforeJson.personBId,
        },
        activePersonIds,
        activeRelationships.map((r) => ({
          type: r.type as "spouse" | "child",
          personAId: r.personAId,
          personBId: r.personBId,
        })),
      );

      if (!validationResult.valid) {
        throw new Error(
          "恢复失败: " + validationResult.error!.message,
        );
      }
    }

    for (const entry of personEntries) {
      await tx.person.update({
        where: { id: entry.entityId },
        data: { deletedAt: null, deletedBy: null, deletionOperationId: null },
      });
    }

    for (const entry of relEntries) {
      await tx.relationship.update({
        where: { id: entry.entityId },
        data: { deletedAt: null, deletedBy: null, deletionOperationId: null },
      });
    }

    await tx.operationBatch.update({
      where: { id: batchId },
      data: { status: "restored" },
    });

    await createAuditBatch(tx, {
      treeId: activeTree.id,
      actorId: userId,
      action: "person_restore",
      summary: { description: "恢复" + personEntries.length + "人及" + relEntries.length + "条关系", restoredBatchId: batchId, personCount: personEntries.length, relationshipCount: relEntries.length },
      entries: [
        ...personEntries.map((e) => ({
          entityType: "person" as const,
          entityId: e.entityId,
          action: "restore" as const,
        })),
        ...relEntries.map((e) => ({
          entityType: "relationship" as const,
          entityId: e.entityId,
          action: "restore" as const,
        })),
      ],
    });
  });

  revalidatePath("/tree");
  revalidatePath("/settings");
}

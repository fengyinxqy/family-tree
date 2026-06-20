"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { validateRelationshipCandidate, type RelationshipCandidate } from "@/lib/integrity";
import {
  activePersonInTree,
  activeRelationshipInTree,
  createAuditBatch,
  createConfirmation,
  consumeConfirmation,
  getTreeRevision,
} from "@/lib/data-safety";

export interface CreateRelationshipInput {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  sortOrder?: number;
  label?: string | null;
}

type GenerationSyncClient = Pick<typeof prisma, "person" | "relationship">;

export async function syncGenerationNumbersForComponent(
  tx: GenerationSyncClient,
  userId: string,
  treeId: string,
  seedPersonId: string,
  seedGenerationNumber: number,
) {
  const [persons, relationships] = await Promise.all([
    tx.person.findMany({
      where: activePersonInTree(userId, treeId),
      select: { id: true, generationNumber: true },
    }),
    tx.relationship.findMany({
      where: activeRelationshipInTree(userId, treeId),
      select: {
        type: true,
        personAId: true,
        personBId: true,
      },
    }),
  ]);

  const personMap = new Map(persons.map((person) => [person.id, person]));
  if (!personMap.has(seedPersonId)) {
    return;
  }

  const adjacency = new Map<string, Array<{ id: string; generation: (current: number) => number }>>();
  for (const person of persons) {
    adjacency.set(person.id, []);
  }

  for (const relationship of relationships) {
    if (relationship.type === "spouse") {
      adjacency.get(relationship.personAId)?.push({
        id: relationship.personBId,
        generation: (current) => current,
      });
      adjacency.get(relationship.personBId)?.push({
        id: relationship.personAId,
        generation: (current) => current,
      });
      continue;
    }

    adjacency.get(relationship.personAId)?.push({
      id: relationship.personBId,
      generation: (current) => current + 1,
    });
    adjacency.get(relationship.personBId)?.push({
      id: relationship.personAId,
      generation: (current) => current - 1,
    });
  }

  const computed = new Map<string, number>([[seedPersonId, seedGenerationNumber]]);
  const queue = [seedPersonId];

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const currentGeneration = computed.get(personId)!;

    for (const next of adjacency.get(personId) ?? []) {
      const nextGeneration = next.generation(currentGeneration);
      if (computed.has(next.id) && computed.get(next.id) === nextGeneration) {
        continue;
      }

      if (!computed.has(next.id)) {
        computed.set(next.id, nextGeneration);
        queue.push(next.id);
      }
    }
  }

  const minimumGeneration = Math.min(...computed.values());
  const offset = minimumGeneration < 1 ? 1 - minimumGeneration : 0;

  await Promise.all(
    [...computed.entries()].map(([personId, generationNumber]) =>
      tx.person.update({
        where: { id: personId },
        data: {
          generationNumber: generationNumber + offset,
        },
      }),
    ),
  );
}

function revalidateRelationshipPaths(personAId: string, personBId: string) {
  revalidatePath("/tree");
  revalidatePath(`/person/${personAId}`);
  revalidatePath(`/person/${personBId}`);
  revalidatePath(`/person/${personAId}/relationships`);
  revalidatePath(`/person/${personBId}/relationships`);
}

export async function createRelationship(input: CreateRelationshipInput) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);

  const result = await prisma.$transaction(async (tx) => {
    // 加载活跃图和当前修订号
    const [persons, relationships, treeRevision] = await Promise.all([
      tx.person.findMany({
        where: activePersonInTree(userId, activeTree.id),
        select: { id: true, name: true, generationNumber: true },
      }),
      tx.relationship.findMany({
        where: activeRelationshipInTree(userId, activeTree.id),
        select: { type: true, personAId: true, personBId: true },
      }),
      getTreeRevision(tx as Parameters<typeof getTreeRevision>[0], activeTree.id),
    ]);

    const activePersonIds = new Set(persons.map((p) => p.id));

    // 执行完整性校验
    const candidate: RelationshipCandidate = {
      type: input.type,
      personAId: input.personAId,
      personBId: input.personBId,
    };

    const integrityResult = validateRelationshipCandidate(
      candidate,
      activePersonIds,
      relationships.map((r) => ({ type: r.type as "spouse" | "child", personAId: r.personAId, personBId: r.personBId })),
    );

    if (!integrityResult.valid) {
      throw new Error(integrityResult.error!.message);
    }

    // 创建关系
    const created = await tx.relationship.create({
      data: {
        type: input.type,
        personAId: input.personAId,
        personBId: input.personBId,
        sortOrder: input.sortOrder ?? 0,
        label: input.label ?? null,
      },
    });

    // 同步世代号
    const personA = persons.find((p) => p.id === input.personAId);
    if (personA) {
      await syncGenerationNumbersForComponent(
        tx,
        userId,
        activeTree.id,
        input.personAId,
        personA.generationNumber,
      );
    }

    // 审计记录
    await createAuditBatch(tx as Parameters<typeof createAuditBatch>[0], {
      treeId: activeTree.id,
      actorId: userId,
      action: "relationship_create",
      summary: { description: "新建" + (input.type === "spouse" ? "配偶" : "亲子") + "关系", type: input.type, relationshipId: created.id },
      entries: [
        {
          entityType: "relationship",
          entityId: created.id,
          action: "create",
          afterJson: { type: input.type, personAId: input.personAId, personBId: input.personBId },
        },
      ],
    });

    return created;
  });

  revalidateRelationshipPaths(input.personAId, input.personBId);
  return result;
}

/**
 * 关系删除影响预览
 */
export async function previewRelationshipDeletion(relationshipId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);

  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId, deletedAt: null },
    include: {
      personA: { select: { id: true, name: true, createdBy: true, treeId: true } },
      personB: { select: { id: true, name: true, createdBy: true, treeId: true } },
    },
  });

  if (
    !relationship ||
    relationship.personA.createdBy !== userId ||
    relationship.personB.createdBy !== userId ||
    relationship.personA.treeId !== activeTree.id
  ) {
    throw new Error("无权操作");
  }

  const revision = await getTreeRevision(prisma, activeTree.id);

  const preview = {
    relationship: {
      id: relationship.id,
      type: relationship.type,
      personA: { id: relationship.personA.id, name: relationship.personA.name },
      personB: { id: relationship.personB.id, name: relationship.personB.name },
    },
    affected: {
      willHide: true,
      note: "删除此关系将使其在树图和详情中不可见",
    },
    revision,
  };

  // 创建确认记录
  const confirmationId = await createConfirmation(prisma, {
    treeId: activeTree.id,
    userId,
    kind: "relationship_delete",
    input: { relationshipId },
    revision,
    previewResult: preview,
  });

  return { preview, confirmationId };
}

/**
 * 确认删除关系（软删除）
 */
export async function deleteRelationship(confirmationId: string, relationshipId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);

  const result = await prisma.$transaction(async (tx) => {
    // 消耗确认
    const currentRevision = await getTreeRevision(tx as Parameters<typeof getTreeRevision>[0], activeTree.id);
    await consumeConfirmation(tx as Parameters<typeof consumeConfirmation>[0], {
      confirmationId,
      treeId: activeTree.id,
      userId,
      kind: "relationship_delete",
      input: { relationshipId },
      currentRevision,
    });

    // 验证关系存在且属于当前用户
    const relationship = await tx.relationship.findUnique({
      where: { id: relationshipId, deletedAt: null },
      include: {
        personA: { select: { createdBy: true, treeId: true } },
        personB: { select: { createdBy: true, treeId: true } },
      },
    });

    if (
      !relationship ||
      relationship.personA.createdBy !== userId ||
      relationship.personB.createdBy !== userId ||
      relationship.personA.treeId !== activeTree.id
    ) {
      throw new Error("无权操作");
    }

    // 软删除
    const updated = await tx.relationship.update({
      where: { id: relationshipId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deletionOperationId: null as unknown as string, // 后面设置
      },
    });

    // 创建审计记录
    const batch = await createAuditBatch(tx as Parameters<typeof createAuditBatch>[0], {
      treeId: activeTree.id,
      actorId: userId,
      action: "relationship_delete",
      summary: { description: "删除" + (relationship.type === "spouse" ? "配偶" : "亲子") + "关系", relationshipId, type: relationship.type },
      entries: [
        {
          entityType: "relationship",
          entityId: relationshipId,
          action: "delete",
          beforeJson: { type: relationship.type, personAId: relationship.personAId, personBId: relationship.personBId },
        },
      ],
    });

    // 关联deletionOperationId
    await tx.relationship.update({
      where: { id: relationshipId },
      data: { deletionOperationId: batch.batchId },
    });

    return updated;
  });

  revalidatePath("/tree");
  return result;
}
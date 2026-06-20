import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditBatch, createConfirmation, consumeConfirmation, getTreeRevision } from "@/lib/data-safety";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { computeWithdrawalDependencies, type WithdrawalContentType } from "@/lib/publication/withdrawal-dependencies";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const previewInputSchema = z.object({
  entityType: z.enum(["PERSON", "PERSON_EVENT", "RELATIONSHIP", "SOURCE_MATERIAL", "MEDIA_OBJECT", "MATERIAL_LINK"]),
  entityId: z.string().min(1),
});

const confirmInputSchema = z.object({
  confirmationId: z.string().min(1),
  entityType: z.enum(["PERSON", "PERSON_EVENT", "RELATIONSHIP", "SOURCE_MATERIAL", "MEDIA_OBJECT", "MATERIAL_LINK"]),
  entityId: z.string().min(1),
  reason: z.string().trim().min(1).max(1000),
});

async function requireWithdrawer() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, tree.id, "publish.manage");
  return { userId: session.user.id, treeId: tree.id };
}

function getEntityLabel(contentType: WithdrawalContentType): string {
  switch (contentType) {
    case "PERSON": return "人物";
    case "PERSON_EVENT": return "人物事件";
    case "RELATIONSHIP": return "关系";
    case "SOURCE_MATERIAL": return "文献资料";
    case "MEDIA_OBJECT": return "媒体文件";
    case "MATERIAL_LINK": return "资料关联";
  }
}

/**
 * 撤回预览：检查依赖冲突，创建一次性确认
 */
export async function previewWithdrawal(input: unknown) {
  const { userId, treeId } = await requireWithdrawer();
  const { entityType, entityId } = previewInputSchema.parse(input);
  const revision = await getTreeRevision(prisma, treeId);
  const plan = await computeWithdrawalDependencies(prisma, treeId, entityType, entityId);
  const preview = { entityType, entityId, entityLabel: getEntityLabel(entityType), canWithdraw: plan.canWithdraw, blockers: plan.blockers, affectedEntityCount: plan.affectedEntityCount, affectedEntities: plan.affectedEntities, revision };
  const confirmationId = await createConfirmation(prisma, { treeId, userId, kind: "content_withdrawal" as const, input: { entityType, entityId }, revision, previewResult: preview });
  return { preview, confirmationId };
}

/**
 * 原子撤回：在确认有效的前提下执行撤回
 */
export async function executeWithdrawal(input: unknown) {
  const { userId, treeId } = await requireWithdrawer();
  const { confirmationId, entityType, entityId, reason } = confirmInputSchema.parse(input);
  const result = await prisma.$transaction(async (tx) => {
    const currentRevision = await getTreeRevision(tx as Parameters<typeof createAuditBatch>[0], treeId);
    await consumeConfirmation(tx as Parameters<typeof createAuditBatch>[0], { confirmationId, treeId, userId, kind: "content_withdrawal" as const, input: { entityType, entityId }, currentRevision });
    const now = new Date();
    const entries: Parameters<typeof createAuditBatch>[1]["entries"] = [];
    switch (entityType) {
      case "PERSON": {
        const person = await tx.person.findFirst({ where: { id: entityId, treeId, deletedAt: null, withdrawnAt: null } });
        if (!person) throw new Error("人员不存在或已被撤回");
        await tx.person.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "person", entityId, action: "withdraw", beforeJson: { name: person.name } });
        break;
      }
      case "RELATIONSHIP": {
        const relationship = await tx.relationship.findFirst({ where: { id: entityId, deletedAt: null, withdrawnAt: null } });
        if (!relationship) throw new Error("关系不存在或已被撤回");
        await tx.relationship.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "relationship", entityId, action: "withdraw", beforeJson: { type: relationship.type } });
        break;
      }
      case "PERSON_EVENT": {
        const event = await tx.personEvent.findFirst({ where: { id: entityId, person: { treeId, deletedAt: null }, withdrawnAt: null } });
        if (!event) throw new Error("人物事件不存在或已被撤回");
        await tx.personEvent.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "person_event", entityId, action: "withdraw" });
        break;
      }
      case "SOURCE_MATERIAL": {
        const material = await tx.sourceMaterial.findFirst({ where: { id: entityId, treeId, deletedAt: null, withdrawnAt: null } });
        if (!material) throw new Error("资料不存在或已被撤回");
        await tx.sourceMaterial.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "source_material", entityId, action: "withdraw", beforeJson: { title: material.title } });
        break;
      }
      case "MEDIA_OBJECT": {
        const media = await tx.mediaObject.findFirst({ where: { id: entityId, deletedAt: null, withdrawnAt: null } });
        if (!media) throw new Error("媒体文件不存在或已被撤回");
        await tx.mediaObject.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "media_object", entityId, action: "withdraw" });
        break;
      }
      case "MATERIAL_LINK": {
        const link = await tx.materialLink.findFirst({ where: { id: entityId, deletedAt: null, withdrawnAt: null } });
        if (!link) throw new Error("资料关联不存在或已被撤回");
        await tx.materialLink.update({ where: { id: entityId }, data: { withdrawnAt: now, withdrawnBy: userId, withdrawalReason: reason } });
        entries.push({ entityType: "material_link", entityId, action: "withdraw" });
        break;
      }
    }
    const audit = await createAuditBatch(tx as Parameters<typeof createAuditBatch>[0], {
      treeId, actorId: userId, action: "content_withdrawal",
      summary: { entityType, entityId, reason },
      entries: [...entries, { entityType: "content_revision", entityId, action: "withdraw", beforeJson: { status: "PUBLISHED" }, afterJson: { status: "PUBLISHED", withdrawnAt: now.toISOString() } }],
    });
    return { withdrawn: true, entityType, entityId, operationId: audit.batchId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath("/tree");
  revalidatePath("/person/[id]", "page");
  revalidatePath("/documents");
  return result;
}

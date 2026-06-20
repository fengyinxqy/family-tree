import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends" | "user"
>;

interface AuditEntryData {
  entityType: "person" | "relationship" | "person_event" | "snapshot" | "source_material" | "media_object" | "material_link" | "family_invitation" | "family_membership" | "family_tree" | "content_revision" | "revision_group" | "revision_provenance" | "review_decision";
  entityId: string;
  action: "create" | "update" | "delete" | "restore" | "snapshot_create" | "invite" | "accept" | "revoke" | "role_change" | "suspend" | "reactivate" | "remove" | "ownership_transfer" | "submit" | "review" | "publish" | "withdraw";
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
}

interface AuditBatchParams {
  treeId: string;
  actorId: string;
  action: string;
  status?: string;
  summary?: Prisma.InputJsonValue;
  entries: AuditEntryData[];
  incrementFamilyRevision?: boolean;
}

export interface AuditBatchResult {
  batchId: string;
  entries: string[];
}

/**
 * 在业务事务中原子地递增多修订号、创建操作批次和审计条目
 */
export async function createAuditBatch(
  tx: TxClient,
  params: AuditBatchParams,
): Promise<AuditBatchResult> {
  // 递增多修订号
  if (params.incrementFamilyRevision !== false) {
    await tx.familyTree.update({
      where: { id: params.treeId },
      data: { dataRevision: { increment: 1 } },
    });
  }

  // 创建操作批次
  const batch = await tx.operationBatch.create({
    data: {
      treeId: params.treeId,
      actorId: params.actorId,
      action: params.action,
      status: params.status ?? "complete",
      summary: params.summary ?? Prisma.JsonNull,
    },
  });

  // 创建审计条目
  const createdEntries: string[] = [];
  for (const entry of params.entries) {
    const created = await tx.auditEntry.create({
      data: {
        batchId: batch.id,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeJson: entry.beforeJson ?? Prisma.DbNull,
        afterJson: entry.afterJson ?? Prisma.DbNull,
      },
    });
    createdEntries.push(created.id);
  }

  return { batchId: batch.id, entries: createdEntries };
}

/**
 * 在业务事务中递增多修订号并创建审计批次
 */
export async function incrementRevisionWithAudit(
  tx: TxClient,
  params: AuditBatchParams,
): Promise<AuditBatchResult> {
  return createAuditBatch(tx, params);
}

/**
 * 获取当前树的修订号
 */
export async function getTreeRevision(
  tx: TxClient,
  treeId: string,
): Promise<number> {
  const tree = await tx.familyTree.findUniqueOrThrow({
    where: { id: treeId },
    select: { dataRevision: true },
  });
  return tree.dataRevision;
}

/**
 * 验证修订号匹配，如不匹配抛出错误
 */
export async function requireRevision(
  tx: TxClient,
  treeId: string,
  expectedRevision: number,
): Promise<void> {
  const current = await getTreeRevision(tx, treeId);
  if (current !== expectedRevision) {
    throw new Error(
      "数据已被修改，请重新预览 (当前修订: ${current}, 预期: ${expectedRevision})",
    );
  }
}

import type { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends" | "user"
>;

export interface OperationHistoryQuery {
  treeId: string;
  userId: string;
  page?: number;
  pageSize?: number;
  action?: string;
}

export interface OperationHistoryItem {
  id: string;
  action: string;
  status: string;
  summary: Record<string, unknown>;
  actorId: string;
  createdAt: Date;
  entryCount: number;
  entries: Array<{
    entityType: string;
    entityId: string;
    action: string;
    beforeJson: Record<string, unknown> | null;
    afterJson: Record<string, unknown> | null;
  }>;
}

export interface OperationHistoryResult {
  items: OperationHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 分页读取操作历史 —— 仅限家谱所有者
 */
export async function getOperationHistory(
  tx: TxClient,
  query: OperationHistoryQuery,
): Promise<OperationHistoryResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  const where: Record<string, unknown> = {
    treeId: query.treeId,
  };

  if (query.action) {
    where.action = query.action;
  }

  const [items, total] = await Promise.all([
    tx.operationBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { entries: true } },
        entries: {
          orderBy: { createdAt: "asc" },
          select: {
            entityType: true,
            entityId: true,
            action: true,
            beforeJson: true,
            afterJson: true,
          },
        },
      },
    }),
    tx.operationBatch.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      status: item.status,
      summary: item.summary as Record<string, unknown>,
      actorId: item.actorId,
      createdAt: item.createdAt,
      entryCount: item._count.entries,
      entries: item.entries.map((e) => ({
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        beforeJson: e.beforeJson as Record<string, unknown> | null,
        afterJson: e.afterJson as Record<string, unknown> | null,
      })),
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * 删除批次列表 —— 用于恢复界面
 */
export async function getDeletionBatches(
  tx: TxClient,
  treeId: string,
): Promise<
  Array<{
    id: string;
    action: string;
    status: string;
    summary: Record<string, unknown>;
    createdAt: Date;
  }>
> {
  const batches = await tx.operationBatch.findMany({
    where: {
      treeId,
      action: { in: ["person_delete", "relationship_delete", "material_delete"] },
      status: "complete",
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return batches.map((b) => ({
    id: b.id,
    action: b.action,
    status: b.status,
    summary: b.summary as Record<string, unknown>,
    createdAt: b.createdAt,
  }));
}

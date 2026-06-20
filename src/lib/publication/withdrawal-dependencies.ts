import type { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "" | "" | "" | "" | "" | "" | "user"
>;

export type WithdrawalContentType =
  | "PERSON"
  | "PERSON_EVENT"
  | "RELATIONSHIP"
  | "SOURCE_MATERIAL"
  | "MEDIA_OBJECT"
  | "MATERIAL_LINK";

export interface WithdrawalDependencyPlan {
  canWithdraw: boolean;
  blockers: string[];
  affectedEntityCount: number;
  affectedEntities: Array<{
    entityType: WithdrawalContentType;
    entityId: string;
    entityLabel: string;
  }>;
}

export async function computeWithdrawalDependencies(
  tx: TxClient,
  treeId: string,
  contentType: WithdrawalContentType,
  entityId: string,
): Promise<WithdrawalDependencyPlan> {
  const blockers: string[] = [];
  const affectedEntities: WithdrawalDependencyPlan["affectedEntities"] = [];

  switch (contentType) {
    case "PERSON": {
      const activeRelationships = await tx.relationship.findMany({
        where: {
          deletedAt: null,
          withdrawnAt: null,
          OR: [
            { personAId: entityId, personA: { treeId, deletedAt: null } },
            { personBId: entityId, personB: { treeId, deletedAt: null } },
          ],
        },
        select: { id: true, type: true },
      });

      if (activeRelationships.length > 0) {
        blockers.push("该人物有 " + activeRelationships.length + " 条活跃关系，需先撤回相关关系");
        for (const rel of activeRelationships) {
          affectedEntities.push({
            entityType: "RELATIONSHIP" as const,
            entityId: rel.id,
            entityLabel: (rel.type === "spouse" ? "配偶" : "亲子") + "关系",
          });
        }
      }

      const materialLinks = await tx.materialLink.findMany({
        where: { personId: entityId, deletedAt: null, material: { treeId, deletedAt: null } },
        select: { id: true, material: { select: { id: true, title: true } } },
      });
      for (const link of materialLinks) {
        affectedEntities.push({
          entityType: "MATERIAL_LINK" as const,
          entityId: link.id,
          entityLabel: "资料关联: " + link.material.title,
        });
      }

      affectedEntities.push({ entityType: "PERSON" as const, entityId, entityLabel: "人物" });
      break;
    }

    case "RELATIONSHIP":
      affectedEntities.push({ entityType: "RELATIONSHIP" as const, entityId, entityLabel: "关系" });
      break;

    case "PERSON_EVENT":
      affectedEntities.push({ entityType: "PERSON_EVENT" as const, entityId, entityLabel: "人物事件" });
      break;

    case "SOURCE_MATERIAL": {
      const activeMedia = await tx.mediaObject.findMany({
        where: { materialId: entityId, deletedAt: null, withdrawnAt: null },
        select: { id: true, originalName: true },
      });
      if (activeMedia.length > 0) {
        blockers.push("该资料有 " + activeMedia.length + " 个活跃媒体文件");
        for (const media of activeMedia) {
          affectedEntities.push({
            entityType: "MEDIA_OBJECT" as const,
            entityId: media.id,
            entityLabel: "媒体文件: " + media.originalName,
          });
        }
      }

      affectedEntities.push({ entityType: "SOURCE_MATERIAL" as const, entityId, entityLabel: "文献资料" });
      break;
    }

    case "MEDIA_OBJECT":
      affectedEntities.push({ entityType: "MEDIA_OBJECT" as const, entityId, entityLabel: "媒体文件" });
      break;

    case "MATERIAL_LINK":
      affectedEntities.push({ entityType: "MATERIAL_LINK" as const, entityId, entityLabel: "资料关联" });
      break;
  }

  return {
    canWithdraw: blockers.length === 0,
    blockers,
    affectedEntityCount: new Set(affectedEntities.map((e) => e.entityId)).size,
    affectedEntities,
  };
}

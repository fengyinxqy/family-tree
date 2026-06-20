import type { Prisma } from "@prisma/client";

/**
 * 活跃人员查询条件 —— 排除已软删除和已撤回的人员
 */
export const ACTIVE_PERSON_WHERE = {
  deletedAt: null,
  withdrawnAt: null,
} as const satisfies Prisma.PersonWhereInput;

/**
 * 活跃关系查询条件 —— 排除已软删除和已撤回的关系
 */
export const ACTIVE_RELATIONSHIP_WHERE = {
  deletedAt: null,
  withdrawnAt: null,
} as const satisfies Prisma.RelationshipWhereInput;

export const ACTIVE_MATERIAL_WHERE = {
  deletedAt: null,
  withdrawnAt: null,
} as const satisfies Prisma.SourceMaterialWhereInput;

export const ACTIVE_MEDIA_WHERE = {
  deletedAt: null,
  withdrawnAt: null,
  material: { deletedAt: null, withdrawnAt: null },
} as const satisfies Prisma.MediaObjectWhereInput;

export const ACTIVE_MATERIAL_LINK_WHERE = {
  deletedAt: null,
  withdrawnAt: null,
  material: { deletedAt: null, withdrawnAt: null },
  OR: [
    { person: { deletedAt: null, withdrawnAt: null } },
    { personEvent: { person: { deletedAt: null, withdrawnAt: null } } },
  ],
} as const satisfies Prisma.MaterialLinkWhereInput;

export function activeMaterialInTree(
  treeId: string,
): Prisma.SourceMaterialWhereInput {
  return { deletedAt: null, withdrawnAt: null, treeId };
}

/**
 * 活跃人员+指定创建者和树的查询条件
 */
export function activePersonInTree(
  treeId: string,
): Prisma.PersonWhereInput {
  return { deletedAt: null, withdrawnAt: null, treeId };
}

/**
 * 活跃关系+两端人员均在指定树中的查询条件
 */
export function activeRelationshipInTree(
  treeId: string,
): Prisma.RelationshipWhereInput {
  return {
    deletedAt: null,
    withdrawnAt: null,
    personA: { deletedAt: null, withdrawnAt: null, treeId },
    personB: { deletedAt: null, withdrawnAt: null, treeId },
  };
}

/**
 * 区分普通读取（排除已删除和已撤回）和恢复读取（包含已删除）
 */
export const READ_MODE = {
  /** 普通业务读取 - 排除已删除和已撤回记录 */
  NORMAL: { deletedAt: null, withdrawnAt: null } as const,
  /** 恢复相关读取 - 包含已删除记录（撤回的仍不可见） */
  RECOVERY: {} as const,
};

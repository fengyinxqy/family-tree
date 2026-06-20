import type { Prisma } from "@prisma/client";

/**
 * 活跃人员查询条件 —— 排除已软删除的人员
 */
export const ACTIVE_PERSON_WHERE = {
  deletedAt: null,
} as const satisfies Prisma.PersonWhereInput;

/**
 * 活跃关系查询条件 —— 排除已软删除的关系
 */
export const ACTIVE_RELATIONSHIP_WHERE = {
  deletedAt: null,
} as const satisfies Prisma.RelationshipWhereInput;

/**
 * 活跃人员+指定创建者和树的查询条件
 */
export function activePersonInTree(
  createdBy: string,
  treeId: string,
): Prisma.PersonWhereInput {
  return { deletedAt: null, createdBy, treeId };
}

/**
 * 活跃关系+两端人员均在指定树中的查询条件
 */
export function activeRelationshipInTree(
  userId: string,
  treeId: string,
): Prisma.RelationshipWhereInput {
  return {
    deletedAt: null,
    personA: { deletedAt: null, createdBy: userId, treeId },
    personB: { deletedAt: null, createdBy: userId, treeId },
  };
}

/**
 * 区分普通读取（排除已删除）和恢复读取（包含已删除）
 */
export const READ_MODE = {
  /** 普通业务读取 - 排除已删除记录 */
  NORMAL: { deletedAt: null } as const,
  /** 恢复相关读取 - 包含已删除记录 */
  RECOVERY: {} as const,
};
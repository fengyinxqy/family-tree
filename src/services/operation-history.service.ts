"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { getOperationHistory } from "@/lib/data-safety/operations";

export async function getOperationHistoryForCurrentUser(page?: number, pageSize?: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");

  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  return getOperationHistory(prisma, { treeId: activeTree.id, userId, page, pageSize });
}
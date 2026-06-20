import { prisma } from "@/lib/prisma";
import type { FamilyAction } from "@/lib/family-access/actions";
import {
  authorizeFamilyActionWithRepository,
  type FamilyMembershipRepository,
} from "@/lib/family-access/authorization-core";

export {
  FamilyAccessError,
  assertFamilyEntityScope,
  type ActiveFamilyMembership,
} from "@/lib/family-access/authorization-core";

const prismaMembershipRepository: FamilyMembershipRepository = {
  async findMembership({ userId, treeId }) {
    return prisma.familyMembership.findUnique({
      where: { treeId_userId: { treeId, userId } },
      select: { id: true, treeId: true, userId: true, role: true, status: true },
    });
  },
};

export async function authorizeFamilyAction(
  userId: string,
  treeId: string,
  action: FamilyAction,
){
  return authorizeFamilyActionWithRepository(prismaMembershipRepository, userId, treeId, action);
}

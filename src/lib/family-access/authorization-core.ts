import { canPerformFamilyAction, type FamilyAction, type FamilyRole } from "./actions";

export type ActiveFamilyMembership = {
  id: string;
  treeId: string;
  userId: string;
  role: FamilyRole;
  status: "ACTIVE";
};

export class FamilyAccessError extends Error {
  constructor(
    message: string,
    public readonly code: "FAMILY_NOT_FOUND" | "FAMILY_ACTION_FORBIDDEN",
    public readonly status: 403 | 404,
  ) {
    super(message);
    this.name = "FamilyAccessError";
  }
}

export interface FamilyMembershipRepository {
  findMembership(input: { userId: string; treeId: string }): Promise<{
    id: string;
    treeId: string;
    userId: string;
    role: FamilyRole;
    status: "ACTIVE" | "SUSPENDED";
  } | null>;
}

export async function authorizeFamilyActionWithRepository(
  repository: FamilyMembershipRepository,
  userId: string,
  treeId: string,
  action: FamilyAction,
): Promise<ActiveFamilyMembership> {
  const membership = await repository.findMembership({ userId, treeId });

  if (!membership || membership.status !== "ACTIVE") {
    throw new FamilyAccessError("家族不存在或无权访问", "FAMILY_NOT_FOUND", 404);
  }

  if (!canPerformFamilyAction(membership.role, action)) {
    throw new FamilyAccessError("当前角色无权执行此操作", "FAMILY_ACTION_FORBIDDEN", 403);
  }

  return { ...membership, status: "ACTIVE" };
}

export function assertFamilyEntityScope(
  entity: { treeId: string } | null | undefined,
  expectedTreeId: string,
): asserts entity is { treeId: string } {
  if (!entity || entity.treeId !== expectedTreeId) {
    throw new FamilyAccessError("记录不存在或无权访问", "FAMILY_NOT_FOUND", 404);
  }
}


"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditBatch } from "@/lib/data-safety";
import { canPerformFamilyAction, type FamilyRole } from "@/lib/family-access/actions";
import {
  assertMembershipRoleChangeAllowed,
  assertInvitationAcceptanceAllowed,
  assertOwnershipTransferTarget,
  createFamilyInvitationSchema,
  createInvitationToken,
  hashInvitationToken,
  normalizeEmail,
} from "@/lib/family-access/membership";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const idSchema = z.string().trim().min(1);

async function requireCurrentUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("未登录");
  }
  return { id: session.user.id, email: normalizeEmail(session.user.email), name: session.user.name };
}

async function requireActiveTree(action: Parameters<typeof authorizeFamilyAction>[2]) {
  const user = await requireCurrentUser();
  const tree = await getActiveFamilyTreeForUser(user.id, user.name);
  const membership = await authorizeFamilyAction(user.id, tree.id, action);
  return { user, tree, membership };
}

function revalidateMembershipViews() {
  revalidatePath("/settings");
  revalidatePath("/tree");
}

export async function getFamilyMembershipOverview() {
  const { user, tree, membership } = await requireActiveTree("family.read.published");
  const canManage = canPerformFamilyAction(membership.role, "membership.manage");

  const members = await prisma.familyMembership.findMany({
    where: canManage ? { treeId: tree.id } : { treeId: tree.id, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  const invitations = canManage
    ? await prisma.familyInvitation.findMany({
        where: { treeId: tree.id, status: "PENDING" },
        select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    tree: { id: tree.id, name: tree.name },
    currentRole: membership.role,
    canManage,
    canTransferOwnership: membership.role === "OWNER",
    members: members.map((item) => ({
      id: item.id,
      userId: item.userId,
      name: item.user.name,
      email: item.user.email,
      role: item.role,
      status: item.status,
      joinedAt: item.joinedAt.toISOString(),
    })),
    invitations: invitations.map((item) => ({
      ...item,
      expiresAt: item.expiresAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function createFamilyInvitation(input: unknown) {
  const { user, tree } = await requireActiveTree("membership.manage");
  const data = createFamilyInvitationSchema.parse(input);
  const existingUser = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existingUser) {
    const existingMembership = await prisma.familyMembership.findUnique({
      where: { treeId_userId: { treeId: tree.id, userId: existingUser.id } },
      select: { id: true },
    });
    if (existingMembership) throw new Error("该用户已经是家族成员");
  }

  const duplicate = await prisma.familyInvitation.findFirst({
    where: { treeId: tree.id, email: data.email, status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (duplicate) throw new Error("该邮箱已有待处理邀请");

  const { token, tokenHash } = createInvitationToken();
  const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.familyInvitation.create({
      data: { treeId: tree.id, email: data.email, role: data.role, tokenHash, expiresAt, invitedBy: user.id },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: "family_invitation_create",
      incrementFamilyRevision: false,
      summary: { invitationId: created.id, email: created.email, role: created.role },
      entries: [{ entityType: "family_invitation", entityId: created.id, action: "invite", afterJson: { email: created.email, role: created.role, expiresAt: created.expiresAt.toISOString() } }],
    });
    return created;
  });
  revalidateMembershipViews();
  return { ...invitation, expiresAt: invitation.expiresAt.toISOString(), createdAt: invitation.createdAt.toISOString(), token };
}

export async function revokeFamilyInvitation(invitationIdInput: string) {
  const invitationId = idSchema.parse(invitationIdInput);
  const { user, tree } = await requireActiveTree("membership.manage");
  await prisma.$transaction(async (tx) => {
    const invitation = await tx.familyInvitation.findFirst({ where: { id: invitationId, treeId: tree.id, status: "PENDING" } });
    if (!invitation) throw new Error("邀请不存在或已失效");
    await tx.familyInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: "family_invitation_revoke",
      incrementFamilyRevision: false,
      summary: { invitationId: invitation.id, email: invitation.email },
      entries: [{ entityType: "family_invitation", entityId: invitation.id, action: "revoke", beforeJson: { email: invitation.email, role: invitation.role } }],
    });
  });
  revalidateMembershipViews();
}

export async function acceptFamilyInvitation(tokenInput: string) {
  const token = z.string().trim().min(20).parse(tokenInput);
  const user = await requireCurrentUser();
  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.familyInvitation.findUnique({ where: { tokenHash } });
  if (!invitation) {
    throw new Error("邀请不存在、已失效或不属于当前账号");
  }
  assertInvitationAcceptanceAllowed(invitation, user.email);

  const membership = await prisma.$transaction(async (tx) => {
    const current = await tx.familyInvitation.findUnique({ where: { tokenHash } });
    if (!current) {
      throw new Error("邀请不存在、已失效或已被使用");
    }
    assertInvitationAcceptanceAllowed(current, user.email);
    const existing = await tx.familyMembership.findUnique({ where: { treeId_userId: { treeId: current.treeId, userId: user.id } } });
    if (existing) throw new Error("你已经是该家族成员");
    const created = await tx.familyMembership.create({ data: { treeId: current.treeId, userId: user.id, role: current.role } });
    await tx.familyInvitation.update({
      where: { id: current.id },
      data: { status: "ACCEPTED", acceptedBy: user.id, acceptedAt: new Date() },
    });
    await createAuditBatch(tx, {
      treeId: current.treeId,
      actorId: user.id,
      action: "family_invitation_accept",
      incrementFamilyRevision: false,
      summary: { invitationId: current.id, membershipId: created.id, role: created.role },
      entries: [
        { entityType: "family_invitation", entityId: current.id, action: "accept", afterJson: { acceptedBy: user.id } },
        { entityType: "family_membership", entityId: created.id, action: "create", afterJson: { userId: user.id, role: created.role, status: created.status } },
      ],
    });
    return created;
  });
  revalidateMembershipViews();
  return { treeId: membership.treeId, role: membership.role };
}

export async function changeFamilyMemberRole(membershipIdInput: string, roleInput: FamilyRole) {
  const membershipId = idSchema.parse(membershipIdInput);
  const { user, tree, membership: actor } = await requireActiveTree("membership.manage");
  await prisma.$transaction(async (tx) => {
    const target = await tx.familyMembership.findFirst({ where: { id: membershipId, treeId: tree.id } });
    if (!target) throw new Error("成员不存在");
    assertMembershipRoleChangeAllowed({ actorRole: actor.role, targetRole: target.role, nextRole: roleInput });
    const role = createFamilyInvitationSchema.shape.role.parse(roleInput);
    await tx.familyMembership.update({ where: { id: target.id }, data: { role } });
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: "family_membership_role_change",
      incrementFamilyRevision: false,
      summary: { membershipId: target.id, from: target.role, to: role },
      entries: [{ entityType: "family_membership", entityId: target.id, action: "role_change", beforeJson: { role: target.role }, afterJson: { role } }],
    });
  });
  revalidateMembershipViews();
}

export async function setFamilyMemberStatus(membershipIdInput: string, status: "ACTIVE" | "SUSPENDED") {
  const membershipId = idSchema.parse(membershipIdInput);
  const { user, tree } = await requireActiveTree("membership.manage");
  await prisma.$transaction(async (tx) => {
    const target = await tx.familyMembership.findFirst({ where: { id: membershipId, treeId: tree.id } });
    if (!target) throw new Error("成员不存在");
    if (target.role === "OWNER") throw new Error("不能停用家族所有者");
    await tx.familyMembership.update({ where: { id: target.id }, data: { status } });
    if (status === "SUSPENDED") {
      await tx.operationConfirmation.updateMany({ where: { treeId: tree.id, userId: target.userId, consumed: false }, data: { consumed: true } });
    }
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: status === "ACTIVE" ? "family_membership_reactivate" : "family_membership_suspend",
      incrementFamilyRevision: false,
      summary: { membershipId: target.id, status },
      entries: [{ entityType: "family_membership", entityId: target.id, action: status === "ACTIVE" ? "reactivate" : "suspend", beforeJson: { status: target.status }, afterJson: { status } }],
    });
  });
  revalidateMembershipViews();
}

export async function removeFamilyMember(membershipIdInput: string) {
  const membershipId = idSchema.parse(membershipIdInput);
  const { user, tree } = await requireActiveTree("membership.manage");
  await prisma.$transaction(async (tx) => {
    const target = await tx.familyMembership.findFirst({ where: { id: membershipId, treeId: tree.id } });
    if (!target) throw new Error("成员不存在");
    if (target.role === "OWNER") throw new Error("不能移除家族所有者");
    await tx.operationConfirmation.updateMany({ where: { treeId: tree.id, userId: target.userId, consumed: false }, data: { consumed: true } });
    await tx.familyMembership.delete({ where: { id: target.id } });
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: "family_membership_remove",
      incrementFamilyRevision: false,
      summary: { membershipId: target.id, userId: target.userId, role: target.role },
      entries: [{ entityType: "family_membership", entityId: target.id, action: "remove", beforeJson: { userId: target.userId, role: target.role, status: target.status } }],
    });
  });
  revalidateMembershipViews();
}

export async function transferFamilyOwnership(targetMembershipIdInput: string) {
  const targetMembershipId = idSchema.parse(targetMembershipIdInput);
  const { user, tree, membership: actor } = await requireActiveTree("ownership.transfer");
  await prisma.$transaction(async (tx) => {
    const target = await tx.familyMembership.findFirst({ where: { id: targetMembershipId, treeId: tree.id, status: "ACTIVE" } });
    if (!target) throw new Error("目标成员不可用于所有权转移");
    assertOwnershipTransferTarget(target);
    await tx.familyMembership.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
    await tx.familyMembership.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.familyTree.update({ where: { id: tree.id }, data: { ownerId: target.userId } });
    await createAuditBatch(tx, {
      treeId: tree.id,
      actorId: user.id,
      action: "family_ownership_transfer",
      incrementFamilyRevision: false,
      summary: { fromUserId: user.id, toUserId: target.userId },
      entries: [
        { entityType: "family_membership", entityId: actor.id, action: "role_change", beforeJson: { role: "OWNER" }, afterJson: { role: "ADMIN" } },
        { entityType: "family_membership", entityId: target.id, action: "role_change", beforeJson: { role: target.role }, afterJson: { role: "OWNER" } },
        { entityType: "family_tree", entityId: tree.id, action: "ownership_transfer", beforeJson: { ownerId: user.id }, afterJson: { ownerId: target.userId } },
      ],
    });
  });
  revalidateMembershipViews();
}

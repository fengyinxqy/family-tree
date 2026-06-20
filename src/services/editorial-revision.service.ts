"use server";

import { Prisma, type RevisionContentType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditBatch } from "@/lib/data-safety";
import { canPerformFamilyAction } from "@/lib/family-access/actions";
import {
  REVISION_CONTENT_TYPES,
  validateRevisionPayloadScope,
  type RevisionScopeRepository,
} from "@/lib/editorial/revision-payloads";
import {
  assertRevisionPayloadMutable,
  assertRevisionTransition,
  validateReviewDecision,
  type ReviewDecision,
} from "@/lib/editorial/revision-workflow";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const draftInputSchema = z.object({
  contentType: z.enum(REVISION_CONTENT_TYPES),
  targetEntityId: z.string().trim().min(1).nullable().optional().default(null),
  schemaVersion: z.number().int().positive().default(1),
  payload: z.unknown(),
});

const reviewInputSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  comment: z.string().max(4000).nullable().optional(),
  overrideReason: z.string().max(1000).nullable().optional(),
});

async function requireRevisionContext(action: Parameters<typeof authorizeFamilyAction>[2]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  const membership = await authorizeFamilyAction(session.user.id, tree.id, action);
  return { userId: session.user.id, treeId: tree.id, membership };
}

const revisionScopeRepository: RevisionScopeRepository = {
  async entityBelongsToTree(type, id, treeId) {
    if (type === "person") return Boolean(await prisma.person.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } }));
    if (type === "person_event") return Boolean(await prisma.personEvent.findFirst({ where: { id, person: { treeId, deletedAt: null } }, select: { id: true } }));
    return Boolean(await prisma.sourceMaterial.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } }));
  },
};

async function getTargetTimestamp(treeId: string, contentType: RevisionContentType, targetEntityId: string | null) {
  if (!targetEntityId) return null;
  if (contentType === "PERSON") return (await prisma.person.findFirst({ where: { id: targetEntityId, treeId, deletedAt: null }, select: { updatedAt: true } }))?.updatedAt ?? null;
  if (contentType === "PERSON_EVENT") return (await prisma.personEvent.findFirst({ where: { id: targetEntityId, person: { treeId, deletedAt: null } }, select: { createdAt: true } }))?.createdAt ?? null;
  if (contentType === "RELATIONSHIP") return (await prisma.relationship.findFirst({ where: { id: targetEntityId, deletedAt: null, personA: { treeId }, personB: { treeId } }, select: { createdAt: true } }))?.createdAt ?? null;
  if (contentType === "SOURCE_MATERIAL") return (await prisma.sourceMaterial.findFirst({ where: { id: targetEntityId, treeId, deletedAt: null }, select: { updatedAt: true } }))?.updatedAt ?? null;
  if (contentType === "MEDIA_OBJECT") return (await prisma.mediaObject.findFirst({ where: { id: targetEntityId, deletedAt: null, material: { treeId, deletedAt: null } }, select: { createdAt: true } }))?.createdAt ?? null;
  if (contentType === "MATERIAL_LINK") return (await prisma.materialLink.findFirst({ where: { id: targetEntityId, deletedAt: null, material: { treeId, deletedAt: null } }, select: { createdAt: true } }))?.createdAt ?? null;
  return null;
}

function revalidateEditorialViews() {
  revalidatePath("/reviews");
  revalidatePath("/tree");
}

export async function createContentDraft(input: unknown) {
  const { userId, treeId } = await requireRevisionContext("revision.create");
  const data = draftInputSchema.parse(input);
  const payload = await validateRevisionPayloadScope(revisionScopeRepository, treeId, data.contentType, data.schemaVersion, data.payload);
  const [tree, baseTargetUpdatedAt, latest] = await Promise.all([
    prisma.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } }),
    getTargetTimestamp(treeId, data.contentType, data.targetEntityId),
    prisma.contentRevision.aggregate({
      where: { treeId, contentType: data.contentType, targetEntityId: data.targetEntityId },
      _max: { version: true },
    }),
  ]);
  if (data.targetEntityId && !baseTargetUpdatedAt) throw new Error("目标记录不存在或不属于当前家族");
  const revision = await prisma.contentRevision.create({
    data: {
      treeId,
      contentType: data.contentType,
      targetEntityId: data.targetEntityId,
      authorId: userId,
      baseFamilyRevision: tree.dataRevision,
      baseTargetUpdatedAt,
      schemaVersion: data.schemaVersion,
      version: (latest._max.version ?? 0) + 1,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  revalidateEditorialViews();
  return revision;
}

export async function updateContentDraft(revisionId: string, payloadInput: unknown) {
  const { userId, treeId } = await requireRevisionContext("revision.create");
  const revision = await prisma.contentRevision.findFirst({ where: { id: revisionId, treeId, authorId: userId } });
  if (!revision) throw new Error("修订不存在或无权访问");
  assertRevisionPayloadMutable(revision.status);
  const payload = await validateRevisionPayloadScope(revisionScopeRepository, treeId, revision.contentType, revision.schemaVersion, payloadInput);
  const updated = await prisma.contentRevision.update({ where: { id: revision.id }, data: { payload: payload as Prisma.InputJsonValue } });
  revalidateEditorialViews();
  return updated;
}

export async function deriveContentDraft(sourceRevisionId: string) {
  const { userId, treeId } = await requireRevisionContext("revision.create");
  const source = await prisma.contentRevision.findFirst({ where: { id: sourceRevisionId, treeId } });
  if (!source || (source.status !== "CHANGES_REQUESTED" && source.status !== "PUBLISHED")) {
    throw new Error("只能从已退回或已发布修订派生新草稿");
  }
  const tree = await prisma.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } });
  const baseTargetUpdatedAt = await getTargetTimestamp(treeId, source.contentType, source.targetEntityId);
  const created = await prisma.contentRevision.create({
    data: {
      treeId,
      contentType: source.contentType,
      targetEntityId: source.targetEntityId,
      authorId: userId,
      parentRevisionId: source.id,
      baseFamilyRevision: tree.dataRevision,
      baseTargetUpdatedAt,
      schemaVersion: source.schemaVersion,
      version: source.version + 1,
      payload: source.payload as Prisma.InputJsonValue,
    },
  });
  revalidateEditorialViews();
  return created;
}

export async function submitContentRevision(revisionId: string) {
  const { userId, treeId } = await requireRevisionContext("family.read.workspace");
  const revision = await prisma.contentRevision.findFirst({ where: { id: revisionId, treeId, authorId: userId } });
  if (!revision) throw new Error("修订不存在或无权提交");
  if (revision.status === "IN_REVIEW") return revision;
  await authorizeFamilyAction(userId, treeId, "revision.submit");
  assertRevisionTransition(revision.status, "IN_REVIEW");
  await validateRevisionPayloadScope(revisionScopeRepository, treeId, revision.contentType, revision.schemaVersion, revision.payload);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contentRevision.update({ where: { id: revision.id }, data: { status: "IN_REVIEW", submittedAt: new Date() } });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "content_revision_submit",
      incrementFamilyRevision: false,
      summary: { revisionId: revision.id, contentType: revision.contentType, targetEntityId: revision.targetEntityId },
      entries: [{ entityType: "content_revision", entityId: revision.id, action: "submit", beforeJson: { status: revision.status }, afterJson: { status: "IN_REVIEW" } }],
    });
    return result;
  });
  revalidateEditorialViews();
  return updated;
}

export async function reviewContentRevision(revisionId: string, input: unknown) {
  const { userId, treeId, membership } = await requireRevisionContext("review.decide");
  const data = reviewInputSchema.parse(input);
  const revision = await prisma.contentRevision.findFirst({ where: { id: revisionId, treeId } });
  if (!revision) throw new Error("待审修订不存在");
  const nextStatus = data.decision as ReviewDecision;
  assertRevisionTransition(revision.status, nextStatus);
  const review = validateReviewDecision({
    ...data,
    decision: data.decision,
    reviewerId: userId,
    authorId: revision.authorId,
    reviewerRole: membership.role,
  });
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contentRevision.update({
      where: { id: revision.id },
      data: { status: nextStatus, approvedAt: nextStatus === "APPROVED" ? new Date() : null },
    });
    const decision = await tx.reviewDecision.create({
      data: { revisionId: revision.id, reviewerId: userId, decision: data.decision, comment: review.comment, overrideReason: review.overrideReason },
    });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "content_revision_review",
      incrementFamilyRevision: false,
      summary: { revisionId: revision.id, decision: data.decision, override: Boolean(review.overrideReason) },
      entries: [
        { entityType: "content_revision", entityId: revision.id, action: "review", beforeJson: { status: revision.status }, afterJson: { status: nextStatus } },
        { entityType: "review_decision", entityId: decision.id, action: "create", afterJson: { decision: data.decision, override: Boolean(review.overrideReason) } },
      ],
    });
    return result;
  });
  revalidateEditorialViews();
  return updated;
}

export async function getReviewQueue() {
  const { userId, treeId, membership } = await requireRevisionContext("review.read");
  return prisma.contentRevision.findMany({
    where: { treeId, groupMembership: null, status: { in: ["IN_REVIEW", "APPROVED"] } },
    include: { author: { select: { id: true, name: true, email: true } }, reviewDecisions: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
  }).then((items) => items.map((item) => ({
    ...item,
    canSubmit: false,
    canDerive: canPerformFamilyAction(membership.role, "revision.create"),
    canPublish: canPerformFamilyAction(membership.role, "publish.manage"),
    canReview: canPerformFamilyAction(membership.role, "review.decide")
      && (item.authorId !== userId || membership.role === "OWNER" || membership.role === "ADMIN"),
  })));
}

export async function getRevisionWorkspace() {
  const { userId, treeId, membership } = await requireRevisionContext("family.read.workspace");
  const canReview = canPerformFamilyAction(membership.role, "review.read");
  return prisma.contentRevision.findMany({
    where: canReview ? { treeId, groupMembership: null } : { treeId, authorId: userId, groupMembership: null },
    include: { author: { select: { id: true, name: true, email: true } }, reviewDecisions: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  }).then((items) => items.map((item) => ({
    ...item,
    canSubmit: item.authorId === userId && canPerformFamilyAction(membership.role, "revision.submit"),
    canDerive: canPerformFamilyAction(membership.role, "revision.create"),
    canPublish: canPerformFamilyAction(membership.role, "publish.manage"),
    canReview: canPerformFamilyAction(membership.role, "review.decide")
      && (item.authorId !== userId || membership.role === "OWNER" || membership.role === "ADMIN"),
  })));
}

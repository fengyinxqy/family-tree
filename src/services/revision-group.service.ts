import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditBatch } from "@/lib/data-safety";
import {
  createRevisionGroupSchema,
  type CreateRevisionGroupInput,
} from "@/lib/editorial/revision-groups";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { validateRevisionPayloadScope, type RevisionScopeRepository } from "@/lib/editorial/revision-payloads";
import type { StandaloneRelationshipRevision } from "@/lib/agent/intake-revision-group";
import { auth } from "@/lib/auth";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { assertRevisionGroupTransition } from "@/lib/editorial/revision-groups";
import { validateReviewDecision, type ReviewDecision } from "@/lib/editorial/revision-workflow";
import { validateRelationshipCandidate } from "@/lib/integrity";
import { assertDependenciesUnchanged } from "@/lib/editorial/publish-conflicts";
import { syncGenerationNumbersForComponent } from "@/services/relationship.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canPerformFamilyAction } from "@/lib/family-access/actions";

async function validateExistingPersonReferences(treeId: string, input: CreateRevisionGroupInput) {
  const ids = new Set<string>();
  for (const member of input.members) {
    if (member.contentType === "PERSON_EVENT" && member.payload.person.kind === "EXISTING") ids.add(member.payload.person.entityId);
    if (member.contentType === "RELATIONSHIP") {
      if (member.payload.personA.kind === "EXISTING") ids.add(member.payload.personA.entityId);
      if (member.payload.personB.kind === "EXISTING") ids.add(member.payload.personB.entityId);
    }
  }
  if (ids.size === 0) return;
  const count = await prisma.person.count({ where: { id: { in: [...ids] }, treeId, deletedAt: null, withdrawnAt: null } });
  if (count !== ids.size) throw new Error("修订组引用的人物不存在或不属于当前家族");
}

const relationshipScopeRepository: RevisionScopeRepository = {
  async entityBelongsToTree(type, id, treeId) {
    if (type !== "person") return false;
    return Boolean(await prisma.person.findFirst({
      where: { id, treeId, deletedAt: null, withdrawnAt: null },
      select: { id: true },
    }));
  },
};

const groupReviewInputSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  comment: z.string().max(4000).nullable().optional(),
  overrideReason: z.string().max(1000).nullable().optional(),
});

async function requireGroupContext(action: Parameters<typeof authorizeFamilyAction>[2]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  const membership = await authorizeFamilyAction(session.user.id, tree.id, action);
  return { userId: session.user.id, treeId: tree.id, membership };
}

function revalidateGroupViews() {
  revalidatePath("/reviews");
  revalidatePath("/tree");
  revalidatePath("/person/[id]", "page");
}

async function loadValidatedGroup(groupId: string, treeId: string) {
  const group = await prisma.revisionGroup.findFirst({
    where: { id: groupId, treeId },
    include: { members: { include: { revision: true }, orderBy: { order: "asc" } }, provenanceEntries: true },
  });
  if (!group) throw new Error("修订组不存在或无权访问");
  const data = createRevisionGroupSchema.parse({
    schemaVersion: group.schemaVersion,
    summary: group.summary,
    source: group.sourceSnapshot,
    members: group.members.map((member) => ({
      contentType: member.revision.contentType,
      order: member.order,
      tempRef: member.tempRef,
      payload: member.revision.payload,
    })),
  });
  await validateExistingPersonReferences(treeId, data);
  return { group, data };
}

export async function createAiRelationshipRevision(
  userId: string,
  treeId: string,
  payloadInput: StandaloneRelationshipRevision,
  source: CreateRevisionGroupInput["source"],
) {
  await authorizeFamilyAction(userId, treeId, "revision.create");
  const payload = await validateRevisionPayloadScope(relationshipScopeRepository, treeId, "RELATIONSHIP", 1, payloadInput);
  return prisma.$transaction(async (tx) => {
    const tree = await tx.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } });
    const revision = await tx.contentRevision.create({
      data: {
        treeId,
        contentType: "RELATIONSHIP",
        authorId: userId,
        baseFamilyRevision: tree.dataRevision,
        schemaVersion: 1,
        version: 1,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await tx.revisionProvenance.create({
      data: {
        treeId,
        revisionId: revision.id,
        kind: "INTAKE_SNAPSHOT",
        sourceTextHash: source.sourceTextHash,
        safeExcerpt: source.safeExcerpt,
        safeSourceLabel: "AI 关系建议",
        createdBy: userId,
      },
    });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "content_revision_create",
      incrementFamilyRevision: false,
      summary: { revisionId: revision.id, contentType: "RELATIONSHIP", sourceKind: "INTAKE_SNAPSHOT" },
      entries: [{ entityType: "content_revision", entityId: revision.id, action: "create", afterJson: { status: "DRAFT", contentType: "RELATIONSHIP" } }],
    });
    return { id: revision.id, status: revision.status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createRevisionGroup(
  userId: string,
  treeId: string,
  input: CreateRevisionGroupInput,
) {
  await authorizeFamilyAction(userId, treeId, "revision.create");
  const data = createRevisionGroupSchema.parse(input);
  await validateExistingPersonReferences(treeId, data);

  return prisma.$transaction(async (tx) => {
    const tree = await tx.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } });
    const group = await tx.revisionGroup.create({
      data: {
        treeId,
        authorId: userId,
        schemaVersion: data.schemaVersion,
        summary: data.summary,
        sourceSnapshot: data.source as Prisma.InputJsonValue,
        sourceTextHash: data.source.sourceTextHash,
        safeSourceExcerpt: data.source.safeExcerpt,
        baseFamilyRevision: tree.dataRevision,
      },
    });

    for (const member of data.members) {
      const revision = await tx.contentRevision.create({
        data: {
          treeId,
          contentType: member.contentType,
          authorId: userId,
          baseFamilyRevision: tree.dataRevision,
          schemaVersion: data.schemaVersion,
          version: 1,
          payload: member.payload as Prisma.InputJsonValue,
        },
      });
      await tx.revisionGroupMember.create({
        data: { groupId: group.id, revisionId: revision.id, order: member.order, tempRef: member.tempRef },
      });
    }

    await tx.revisionProvenance.create({
      data: {
        treeId,
        groupId: group.id,
        kind: "INTAKE_SNAPSHOT",
        sourceTextHash: data.source.sourceTextHash,
        safeExcerpt: data.source.safeExcerpt,
        safeSourceLabel: "AI 录入口述",
        createdBy: userId,
      },
    });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "revision_group_create",
      incrementFamilyRevision: false,
      summary: { groupId: group.id, memberCount: data.members.length, sourceKind: "INTAKE_SNAPSHOT" },
      entries: [{ entityType: "revision_group", entityId: group.id, action: "create", afterJson: { status: "DRAFT", memberCount: data.members.length } }],
    });
    return { id: group.id, status: group.status, memberCount: data.members.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitRevisionGroup(groupId: string) {
  const { userId, treeId } = await requireGroupContext("family.read.workspace");
  const { group } = await loadValidatedGroup(groupId, treeId);
  if (group.authorId !== userId) throw new Error("修订组不存在或无权提交");
  if (group.status === "IN_REVIEW") return group;
  await authorizeFamilyAction(userId, treeId, "revision.submit");
  assertRevisionGroupTransition(group.status, "IN_REVIEW");
  if (group.provenanceEntries.length === 0) throw new Error("提交审校前必须声明资料来源或人工知识来源");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.revisionGroup.update({ where: { id: group.id }, data: { status: "IN_REVIEW", submittedAt: new Date() } });
    await tx.contentRevision.updateMany({ where: { groupMembership: { groupId: group.id } }, data: { status: "IN_REVIEW", submittedAt: new Date() } });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "revision_group_submit",
      incrementFamilyRevision: false,
      summary: { groupId: group.id, memberCount: group.members.length },
      entries: [{ entityType: "revision_group", entityId: group.id, action: "submit", beforeJson: { status: group.status }, afterJson: { status: "IN_REVIEW" } }],
    });
    return result;
  });
  revalidateGroupViews();
  return updated;
}

export async function reviewRevisionGroup(groupId: string, input: unknown) {
  const { userId, treeId, membership } = await requireGroupContext("review.decide");
  const data = groupReviewInputSchema.parse(input);
  const group = await prisma.revisionGroup.findFirst({ where: { id: groupId, treeId }, include: { members: true } });
  if (!group) throw new Error("待审修订组不存在");
  const nextStatus = data.decision as ReviewDecision;
  assertRevisionGroupTransition(group.status, nextStatus);
  const review = validateReviewDecision({
    ...data,
    reviewerId: userId,
    authorId: group.authorId,
    reviewerRole: membership.role,
  });
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.revisionGroup.update({
      where: { id: group.id },
      data: { status: nextStatus, approvedAt: nextStatus === "APPROVED" ? new Date() : null },
    });
    await tx.contentRevision.updateMany({ where: { groupMembership: { groupId: group.id } }, data: { status: nextStatus, approvedAt: nextStatus === "APPROVED" ? new Date() : null } });
    const decision = await tx.reviewDecision.create({
      data: { groupId: group.id, reviewerId: userId, decision: data.decision, comment: review.comment, overrideReason: review.overrideReason },
    });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "revision_group_review",
      incrementFamilyRevision: false,
      summary: { groupId: group.id, decision: data.decision, memberCount: group.members.length, override: Boolean(review.overrideReason) },
      entries: [
        { entityType: "revision_group", entityId: group.id, action: "review", beforeJson: { status: group.status }, afterJson: { status: nextStatus } },
        { entityType: "review_decision", entityId: decision.id, action: "create", afterJson: { decision: data.decision, override: Boolean(review.overrideReason) } },
      ],
    });
    return result;
  });
  revalidateGroupViews();
  return updated;
}

export async function publishRevisionGroup(groupId: string) {
  const { userId, treeId } = await requireGroupContext("publish.manage");
  const existing = await prisma.revisionGroup.findFirst({ where: { id: groupId, treeId } });
  if (!existing) throw new Error("修订组不存在");
  if (existing.status === "PUBLISHED") {
    return { groupId: existing.id, operationId: existing.publishOperationId, published: true };
  }
  if (existing.status !== "APPROVED") throw new Error("只有已通过审校的修订组可以发布");

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.revisionGroup.findFirst({
      where: { id: groupId, treeId },
      include: { members: { include: { revision: true }, orderBy: { order: "asc" } }, provenanceEntries: true },
    });
    if (!group || group.status !== "APPROVED") throw new Error("修订组已不处于可发布状态");
    const data = createRevisionGroupSchema.parse({
      schemaVersion: group.schemaVersion,
      summary: group.summary,
      source: group.sourceSnapshot,
      members: group.members.map((member) => ({ contentType: member.revision.contentType, order: member.order, tempRef: member.tempRef, payload: member.revision.payload })),
    });
    if (group.provenanceEntries.length === 0) throw new Error("修订组缺少可追溯来源");
    const tree = await tx.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } });
    assertDependenciesUnchanged(group.baseFamilyRevision, tree.dataRevision);

    const resolved = new Map<string, string>();
    const publishedByRevision = new Map<string, string>();
    const entries: Parameters<typeof createAuditBatch>[1]["entries"] = [];

    for (const member of data.members) {
      if (member.contentType !== "PERSON") continue;
      const created = await tx.person.create({
        data: {
          treeId,
          createdBy: group.authorId,
          name: member.payload.name,
          gender: member.payload.gender,
          birthDate: member.payload.birthDate,
          deathDate: member.payload.deathDate,
          bio: member.payload.bio,
        },
      });
      resolved.set(member.tempRef, created.id);
      const revisionId = group.members.find((item) => item.tempRef === member.tempRef)!.revisionId;
      publishedByRevision.set(revisionId, created.id);
      entries.push({ entityType: "person", entityId: created.id, action: "create", afterJson: { name: created.name, gender: created.gender } });
    }

    const resolveEntity = (reference: { kind: "EXISTING"; entityId: string } | { kind: "TEMPORARY"; tempRef: string }) => {
      if (reference.kind === "EXISTING") return reference.entityId;
      const id = resolved.get(reference.tempRef);
      if (!id) throw new Error(`无法解析临时引用 ${reference.tempRef}`);
      return id;
    };

    for (const member of data.members) {
      if (member.contentType !== "PERSON_EVENT") continue;
      const personId = resolveEntity(member.payload.person);
      const { person: _person, evidence: _evidence, ...eventPayload } = member.payload;
      const created = await tx.personEvent.create({ data: { ...eventPayload, personId } });
      resolved.set(member.tempRef, created.id);
      const revisionId = group.members.find((item) => item.tempRef === member.tempRef)!.revisionId;
      publishedByRevision.set(revisionId, created.id);
      entries.push({ entityType: "person_event", entityId: created.id, action: "create", afterJson: { personId, type: created.type, title: created.title } });
    }

    const people = await tx.person.findMany({ where: { treeId, deletedAt: null, withdrawnAt: null }, select: { id: true } });
    const existingRelationships = await tx.relationship.findMany({
      where: { deletedAt: null, withdrawnAt: null, personA: { treeId }, personB: { treeId } },
      select: { type: true, personAId: true, personBId: true },
    });
    const relationshipCandidates = existingRelationships.map((item) => ({ ...item, type: item.type as "spouse" | "child" }));
    for (const member of data.members) {
      if (member.contentType !== "RELATIONSHIP") continue;
      const payload = {
        type: member.payload.type,
        personAId: resolveEntity(member.payload.personA),
        personBId: resolveEntity(member.payload.personB),
        label: member.payload.label,
        sortOrder: member.payload.sortOrder,
      };
      const integrity = validateRelationshipCandidate(payload, new Set(people.map((person) => person.id)), relationshipCandidates);
      if (!integrity.valid) throw new Error(integrity.error?.message ?? "关系完整性校验失败");
      const created = await tx.relationship.create({ data: payload });
      relationshipCandidates.push(payload);
      resolved.set(member.tempRef, created.id);
      const revisionId = group.members.find((item) => item.tempRef === member.tempRef)!.revisionId;
      publishedByRevision.set(revisionId, created.id);
      entries.push({ entityType: "relationship", entityId: created.id, action: "create", afterJson: payload });
      if (payload.type === "child") await syncGenerationNumbersForComponent(tx, group.authorId, treeId, payload.personAId, 1);
    }

    const audit = await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "revision_group_publish",
      summary: { groupId: group.id, memberCount: group.members.length },
      entries: [...entries, { entityType: "revision_group", entityId: group.id, action: "publish", beforeJson: { status: group.status }, afterJson: { status: "PUBLISHED", memberCount: group.members.length } }],
    });
    for (const member of group.members) {
      await tx.contentRevision.update({
        where: { id: member.revisionId },
        data: { status: "PUBLISHED", targetEntityId: publishedByRevision.get(member.revisionId), publishedAt: new Date(), publishedBy: userId, publishOperationId: audit.batchId },
      });
    }
    await tx.revisionGroup.update({
      where: { id: group.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedBy: userId, publishOperationId: audit.batchId },
    });
    return { groupId: group.id, operationId: audit.batchId, published: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateGroupViews();
  return result;
}

function toGroupWorkspaceItem<
  T extends Awaited<ReturnType<typeof queryRevisionGroups>>[number]
>(item: T, userId: string, role: Parameters<typeof canPerformFamilyAction>[0]) {
  return {
    kind: "group" as const,
    id: item.id,
    summary: item.summary,
    status: item.status,
    authorId: item.authorId,
    submittedAt: item.submittedAt,
    updatedAt: item.updatedAt,
    author: item.author,
    memberCount: item.members.length,
    members: item.members.map((member) => ({
      id: member.id,
      order: member.order,
      tempRef: member.tempRef,
      contentType: member.revision.contentType,
      payload: member.revision.payload,
    })),
    reviewDecisions: item.reviewDecisions,
    provenance: item.provenanceEntries.map((entry) => ({ kind: entry.kind, safeSourceLabel: entry.safeSourceLabel })),
    canSubmit: item.authorId === userId && canPerformFamilyAction(role, "revision.submit"),
    canPublish: canPerformFamilyAction(role, "publish.manage"),
    canReview: canPerformFamilyAction(role, "review.decide")
      && (item.authorId !== userId || role === "OWNER" || role === "ADMIN"),
  };
}

function queryRevisionGroups(treeId: string, where: Prisma.RevisionGroupWhereInput) {
  return prisma.revisionGroup.findMany({
    where: { treeId, ...where },
    include: {
      author: { select: { id: true, name: true, email: true } },
      members: { include: { revision: { select: { contentType: true, payload: true } } }, orderBy: { order: "asc" } },
      reviewDecisions: { orderBy: { createdAt: "desc" } },
      provenanceEntries: { select: { kind: true, safeSourceLabel: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getRevisionGroupWorkspace() {
  const { userId, treeId, membership } = await requireGroupContext("family.read.workspace");
  const canReview = canPerformFamilyAction(membership.role, "review.read");
  const items = await queryRevisionGroups(treeId, canReview ? {} : { authorId: userId });
  return items.map((item) => toGroupWorkspaceItem(item, userId, membership.role));
}

export async function getRevisionGroupReviewQueue() {
  const { userId, treeId, membership } = await requireGroupContext("review.read");
  const items = await queryRevisionGroups(treeId, { status: { in: ["IN_REVIEW", "APPROVED"] } });
  return items.map((item) => toGroupWorkspaceItem(item, userId, membership.role));
}

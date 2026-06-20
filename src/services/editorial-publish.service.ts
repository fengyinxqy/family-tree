"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditBatch } from "@/lib/data-safety";
import {
  materialLinkRevisionPayloadSchema,
  mediaObjectRevisionPayloadSchema,
  parseRevisionPayload,
  personEventRevisionPayloadSchema,
  personRevisionPayloadSchema,
  relationshipRevisionPayloadSchema,
  sourceMaterialRevisionPayloadSchema,
} from "@/lib/editorial/revision-payloads";
import { PublishConflictError, assertDependenciesUnchanged, assertTargetUnchanged } from "@/lib/editorial/publish-conflicts";
import { validateRelationshipCandidate } from "@/lib/integrity";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { revalidatePath } from "next/cache";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, tree.id, "publish.manage");
  return { userId: session.user.id, treeId: tree.id };
}

function revalidatePublishedViews() {
  revalidatePath("/tree");
  revalidatePath("/documents");
  revalidatePath("/reviews");
  revalidatePath("/person/[id]", "page");
}

export async function publishContentRevision(revisionId: string) {
  const { userId, treeId } = await requirePublisher();
  const initialRevision = await prisma.contentRevision.findFirst({ where: { id: revisionId, treeId } });
  if (!initialRevision || initialRevision.status !== "APPROVED") {
    throw new PublishConflictError("REVISION_NOT_APPROVED", "只有已通过审校的修订可以发布");
  }
  parseRevisionPayload(initialRevision.contentType, initialRevision.schemaVersion, initialRevision.payload);

  let finalizedStorageKey: string | null = null;
  let stagedUploadId: string | null = null;
  if (initialRevision.contentType === "MEDIA_OBJECT") {
    const payload = mediaObjectRevisionPayloadSchema.parse(initialRevision.payload);
    const staged = await prisma.stagedMediaUpload.findFirst({
      where: { id: payload.stagedObjectId, treeId, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!staged || staged.byteSize !== payload.byteSize || staged.contentHash !== payload.contentHash || staged.mimeType !== payload.mimeType) {
      throw new Error("暂存文件不存在、已失效或元数据不匹配");
    }
    finalizedStorageKey = await getObjectStorage().finalize(staged.temporaryKey);
    stagedUploadId = staged.id;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const revision = await tx.contentRevision.findFirst({ where: { id: revisionId, treeId } });
      if (!revision || revision.status !== "APPROVED") throw new PublishConflictError("REVISION_NOT_APPROVED", "修订已不处于可发布状态");
      const tree = await tx.familyTree.findUniqueOrThrow({ where: { id: treeId }, select: { dataRevision: true } });
      const entries: Parameters<typeof createAuditBatch>[1]["entries"] = [];
      let publishedEntityId = revision.targetEntityId;

      if (revision.contentType === "PERSON") {
        const payload = personRevisionPayloadSchema.parse(revision.payload);
        const { events, ...personPayload } = payload;
        if (revision.targetEntityId) {
          const current = await tx.person.findFirst({ where: { id: revision.targetEntityId, treeId, deletedAt: null } });
          if (!current) throw new PublishConflictError("STALE_TARGET", "目标人物不存在或已删除");
          assertTargetUnchanged(revision.baseTargetUpdatedAt, current.updatedAt);
          await tx.person.update({ where: { id: current.id }, data: personPayload });
          await tx.personEvent.deleteMany({ where: { personId: current.id } });
          if (events.length > 0) await tx.personEvent.createMany({ data: events.map((event) => ({ ...event, personId: current.id })) });
          entries.push({ entityType: "person", entityId: current.id, action: "update", beforeJson: { name: current.name, updatedAt: current.updatedAt.toISOString() }, afterJson: payload as Prisma.InputJsonValue });
        } else {
          const created = await tx.person.create({ data: { ...personPayload, treeId, createdBy: revision.authorId } });
          if (events.length > 0) await tx.personEvent.createMany({ data: events.map((event) => ({ ...event, personId: created.id })) });
          publishedEntityId = created.id;
          entries.push({ entityType: "person", entityId: created.id, action: "create", afterJson: payload as Prisma.InputJsonValue });
        }
      } else if (revision.contentType === "PERSON_EVENT") {
        assertDependenciesUnchanged(revision.baseFamilyRevision, tree.dataRevision);
        const payload = personEventRevisionPayloadSchema.parse(revision.payload);
        if (revision.targetEntityId) {
          const current = await tx.personEvent.findFirst({ where: { id: revision.targetEntityId, person: { treeId, deletedAt: null } } });
          if (!current) throw new PublishConflictError("STALE_TARGET", "目标事件不存在");
          await tx.personEvent.update({ where: { id: current.id }, data: payload });
          entries.push({ entityType: "person_event", entityId: current.id, action: "update", beforeJson: { title: current.title, type: current.type }, afterJson: payload as Prisma.InputJsonValue });
        } else {
          const created = await tx.personEvent.create({ data: payload });
          publishedEntityId = created.id;
          entries.push({ entityType: "person_event", entityId: created.id, action: "create", afterJson: payload as Prisma.InputJsonValue });
        }
      } else if (revision.contentType === "RELATIONSHIP") {
        assertDependenciesUnchanged(revision.baseFamilyRevision, tree.dataRevision);
        const payload = relationshipRevisionPayloadSchema.parse(revision.payload);
        const [people, relationships] = await Promise.all([
          tx.person.findMany({ where: { treeId, deletedAt: null }, select: { id: true } }),
          tx.relationship.findMany({
            where: { deletedAt: null, personA: { treeId }, id: revision.targetEntityId ? { not: revision.targetEntityId } : undefined },
            select: { type: true, personAId: true, personBId: true },
          }),
        ]);
        const integrity = validateRelationshipCandidate(payload, new Set(people.map((person) => person.id)), relationships.map((item) => ({ ...item, type: item.type as "spouse" | "child" })));
        if (!integrity.valid) throw new Error(JSON.stringify(integrity.error));
        if (revision.targetEntityId) {
          const current = await tx.relationship.findFirst({ where: { id: revision.targetEntityId, deletedAt: null, personA: { treeId }, personB: { treeId } } });
          if (!current) throw new PublishConflictError("STALE_TARGET", "目标关系不存在");
          await tx.relationship.update({ where: { id: current.id }, data: payload });
          entries.push({ entityType: "relationship", entityId: current.id, action: "update", beforeJson: { type: current.type, personAId: current.personAId, personBId: current.personBId }, afterJson: payload as Prisma.InputJsonValue });
        } else {
          const created = await tx.relationship.create({ data: payload });
          publishedEntityId = created.id;
          entries.push({ entityType: "relationship", entityId: created.id, action: "create", afterJson: payload as Prisma.InputJsonValue });
        }
      } else if (revision.contentType === "SOURCE_MATERIAL") {
        const payload = sourceMaterialRevisionPayloadSchema.parse(revision.payload);
        if (revision.targetEntityId) {
          const current = await tx.sourceMaterial.findFirst({ where: { id: revision.targetEntityId, treeId, deletedAt: null } });
          if (!current) throw new PublishConflictError("STALE_TARGET", "目标资料不存在");
          assertTargetUnchanged(revision.baseTargetUpdatedAt, current.updatedAt);
          await tx.sourceMaterial.update({ where: { id: current.id }, data: payload });
          entries.push({ entityType: "source_material", entityId: current.id, action: "update", beforeJson: { title: current.title, updatedAt: current.updatedAt.toISOString() }, afterJson: payload as Prisma.InputJsonValue });
        } else {
          const created = await tx.sourceMaterial.create({ data: { ...payload, treeId, createdBy: revision.authorId } });
          publishedEntityId = created.id;
          entries.push({ entityType: "source_material", entityId: created.id, action: "create", afterJson: payload as Prisma.InputJsonValue });
        }
      } else if (revision.contentType === "MEDIA_OBJECT") {
        assertDependenciesUnchanged(revision.baseFamilyRevision, tree.dataRevision);
        const payload = mediaObjectRevisionPayloadSchema.parse(revision.payload);
        if (!finalizedStorageKey || !stagedUploadId) throw new Error("媒体文件尚未完成暂存");
        const staged = await tx.stagedMediaUpload.findFirst({ where: { id: stagedUploadId, treeId, consumedAt: null } });
        if (!staged) throw new Error("暂存文件已被使用");
        const created = await tx.mediaObject.create({
          data: { materialId: payload.materialId, originalName: payload.originalName, mimeType: payload.mimeType, byteSize: payload.byteSize, contentHash: payload.contentHash, displayOrder: payload.displayOrder, storageKey: finalizedStorageKey },
        });
        await tx.stagedMediaUpload.update({ where: { id: staged.id }, data: { consumedAt: new Date() } });
        publishedEntityId = created.id;
        entries.push({ entityType: "media_object", entityId: created.id, action: "create", afterJson: { materialId: payload.materialId, originalName: payload.originalName, mimeType: payload.mimeType, byteSize: payload.byteSize, contentHash: payload.contentHash } });
      } else if (revision.contentType === "MATERIAL_LINK") {
        assertDependenciesUnchanged(revision.baseFamilyRevision, tree.dataRevision);
        const payload = materialLinkRevisionPayloadSchema.parse(revision.payload);
        const material = await tx.sourceMaterial.findFirst({ where: { id: payload.materialId, treeId, deletedAt: null } });
        if (!material) throw new PublishConflictError("STALE_TARGET", "目标资料不存在或已删除");
        const before = await tx.materialLink.findMany({ where: { materialId: payload.materialId, deletedAt: null }, select: { personId: true, personEventId: true } });
        await tx.materialLink.deleteMany({ where: { materialId: payload.materialId } });
        if (payload.targets.length > 0) {
          await tx.materialLink.createMany({ data: payload.targets.map((target) => ({ materialId: payload.materialId, ...target })) });
        }
        publishedEntityId = payload.materialId;
        entries.push({ entityType: "source_material", entityId: payload.materialId, action: "update", beforeJson: { links: before }, afterJson: { links: payload.targets } });
      } else {
        throw new Error("该修订类型尚未接入发布适配器");
      }

      const audit = await createAuditBatch(tx, {
        treeId,
        actorId: userId,
        action: "content_revision_publish",
        summary: { revisionId: revision.id, contentType: revision.contentType, entityId: publishedEntityId },
        entries: [...entries, { entityType: "content_revision", entityId: revision.id, action: "publish", beforeJson: { status: revision.status }, afterJson: { status: "PUBLISHED", entityId: publishedEntityId } }],
      });
      await tx.contentRevision.update({
        where: { id: revision.id },
        data: { status: "PUBLISHED", targetEntityId: publishedEntityId, publishedAt: new Date(), publishedBy: userId, publishOperationId: audit.batchId },
      });
      return { revisionId: revision.id, entityId: publishedEntityId, operationId: audit.batchId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePublishedViews();
    return result;
  } catch (error) {
    if (finalizedStorageKey) await getObjectStorage().remove(finalizedStorageKey).catch(() => undefined);
    throw error;
  }
}

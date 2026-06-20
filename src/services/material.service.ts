"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAuditBatch,
  createConfirmation,
  consumeConfirmation,
  getTreeRevision,
} from "@/lib/data-safety";
import { materialInputSchema, validateMaterialLinkTargets, type MaterialLinkTarget } from "@/lib/materials/validation";
import { getFileLimits, validateFileBytes } from "@/lib/materials/file-validation";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import type { MaterialCategory } from "@/types";
import type { FamilyAction } from "@/lib/family-access/actions";
import { authorizeFamilyAction } from "@/services/family-authorization.service";

type MaterialInput = {
  title: string;
  category: string;
  source?: string | null;
  eraLabel?: string | null;
  contributor?: string | null;
  description?: string | null;
};

async function requireMaterialContext(action: FamilyAction = "family.read.published") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, tree.id, action);
  return { userId: session.user.id, treeId: tree.id };
}

const materialInclude = {
  files: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      byteSize: true,
      contentHash: true,
      displayOrder: true,
    },
  },
  links: {
    where: {
      deletedAt: null,
      OR: [
        { person: { deletedAt: null } },
        { personEvent: { person: { deletedAt: null } } },
      ],
    },
    select: {
      id: true,
      personId: true,
      personEventId: true,
      person: { select: { name: true } },
      personEvent: { select: { title: true, type: true, person: { select: { name: true } } } },
    },
  },
} satisfies Prisma.SourceMaterialInclude;

function toMaterialDto<T extends {
  id: string;
  title: string;
  category: string;
  source: string | null;
  eraLabel: string | null;
  contributor: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  files: Array<{ id: string; originalName: string; mimeType: string; byteSize: number; contentHash: string; displayOrder: number }>;
  links: Array<{ id: string; personId: string | null; personEventId: string | null; person: { name: string } | null; personEvent: { title: string | null; type: string; person: { name: string } } | null }>;
}>(material: T) {
  return {
    id: material.id,
    title: material.title,
    category: material.category as MaterialCategory,
    source: material.source,
    eraLabel: material.eraLabel,
    contributor: material.contributor,
    description: material.description,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
    files: material.files,
    links: material.links.map((link) => ({
      id: link.id,
      personId: link.personId,
      personEventId: link.personEventId,
      label: link.person?.name ?? (link.personEvent ? `${link.personEvent.person.name} · ${link.personEvent.title || link.personEvent.type}` : null),
    })),
  };
}

export async function listMaterials(input: { page?: number; pageSize?: number; q?: string; category?: string } = {}) {
  const { treeId } = await requireMaterialContext();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 12));
  const category = input.category && input.category !== "all" ? materialInputSchema.shape.category.parse(input.category) : undefined;
  const q = input.q?.trim();
  const where = {
    treeId,
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { source: { contains: q, mode: "insensitive" as const } },
            { contributor: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.sourceMaterial.findMany({
      where,
      include: materialInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sourceMaterial.count({ where }),
  ]);

  return { items: items.map(toMaterialDto), total, page, pageSize };
}

export async function getMaterial(materialId: string) {
  const { treeId } = await requireMaterialContext();
  const material = await prisma.sourceMaterial.findFirst({
    where: { id: materialId, treeId, deletedAt: null },
    include: materialInclude,
  });
  if (!material) throw new Error("资料不存在");
  return toMaterialDto(material);
}

export async function createMaterial(input: MaterialInput) {
  const { userId, treeId } = await requireMaterialContext("content.edit.direct");
  const data = materialInputSchema.parse(input);
  const material = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceMaterial.create({ data: { ...data, treeId, createdBy: userId } });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "material_create",
      summary: { materialId: created.id, title: created.title },
      entries: [{ entityType: "source_material", entityId: created.id, action: "create", afterJson: data }],
    });
    return created;
  });
  revalidatePath("/documents");
  return getMaterial(material.id);
}

export async function updateMaterial(materialId: string, input: MaterialInput) {
  const { userId, treeId } = await requireMaterialContext("content.edit.direct");
  const data = materialInputSchema.parse(input);
  const existing = await prisma.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null } });
  if (!existing) throw new Error("资料不存在");

  await prisma.$transaction(async (tx) => {
    await tx.sourceMaterial.update({ where: { id: materialId }, data });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "material_update",
      summary: { materialId, title: data.title },
      entries: [{ entityType: "source_material", entityId: materialId, action: "update", beforeJson: { title: existing.title, category: existing.category }, afterJson: data }],
    });
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${materialId}`);
  return getMaterial(materialId);
}

export async function replaceMaterialLinks(materialId: string, targets: MaterialLinkTarget[]) {
  const { userId, treeId } = await requireMaterialContext("content.edit.direct");
  const material = await prisma.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null } });
  if (!material) throw new Error("资料不存在");

  const personIds = targets.flatMap((target) => (target.personId ? [target.personId] : []));
  const eventIds = targets.flatMap((target) => (target.personEventId ? [target.personEventId] : []));
  const [people, events] = await Promise.all([
    prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, treeId: true, deletedAt: true } }),
    prisma.personEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, person: { select: { treeId: true, deletedAt: true } } } }),
  ]);
  const normalized = validateMaterialLinkTargets(targets, { treeId, people, events });

  await prisma.$transaction(async (tx) => {
    await tx.materialLink.deleteMany({ where: { materialId } });
    if (normalized.length > 0) await tx.materialLink.createMany({ data: normalized.map((target) => ({ materialId, ...target })) });
    await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "material_links_replace",
      summary: { materialId, linkCount: normalized.length },
      entries: [{ entityType: "source_material", entityId: materialId, action: "update", afterJson: { links: normalized } }],
    });
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${materialId}`);
  revalidatePath("/person/[id]", "page");
  return getMaterial(materialId);
}

export async function attachMaterialFile(materialId: string, file: File) {
  const { userId, treeId } = await requireMaterialContext("file.manage");
  const material = await prisma.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null }, include: { _count: { select: { files: { where: { deletedAt: null } } } } } });
  if (!material) throw new Error("资料不存在");
  if (material._count.files >= getFileLimits().maxFiles) throw new Error("资料包含的文件数量已达上限");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = validateFileBytes({ bytes, declaredMimeType: file.type, filename: file.name });
  const storage = getObjectStorage();
  const staged = await storage.stage(bytes);
  let storageKey: string | null = null;

  try {
    storageKey = await storage.finalize(staged.temporaryKey);
    const media = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaObject.create({ data: { materialId, storageKey: storageKey!, displayOrder: material._count.files, ...metadata } });
      await createAuditBatch(tx, {
        treeId,
        actorId: userId,
        action: "material_file_attach",
        summary: { materialId, fileId: created.id, originalName: created.originalName },
        entries: [{ entityType: "media_object", entityId: created.id, action: "create", afterJson: metadata }],
      });
      return created;
    });
    revalidatePath("/documents");
    revalidatePath(`/documents/${materialId}`);
    return { id: media.id, ...metadata, displayOrder: media.displayOrder };
  } catch (error) {
    await storage.remove(storageKey ?? staged.temporaryKey).catch(() => undefined);
    throw error;
  }
}

export async function reorderMaterialFiles(materialId: string, fileIds: string[]) {
  const { userId, treeId } = await requireMaterialContext("file.manage");
  const material = await prisma.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null }, include: { files: { where: { deletedAt: null }, select: { id: true } } } });
  if (!material) throw new Error("资料不存在");
  const existingIds = new Set(material.files.map((file) => file.id));
  if (fileIds.length !== existingIds.size || new Set(fileIds).size !== fileIds.length || fileIds.some((id) => !existingIds.has(id))) throw new Error("文件排序列表不完整");

  await prisma.$transaction(async (tx) => {
    for (const [displayOrder, id] of fileIds.entries()) await tx.mediaObject.update({ where: { id }, data: { displayOrder } });
    await createAuditBatch(tx, { treeId, actorId: userId, action: "material_files_reorder", summary: { materialId, fileIds }, entries: [{ entityType: "source_material", entityId: materialId, action: "update", afterJson: { fileIds } }] });
  });
  revalidatePath(`/documents/${materialId}`);
  return getMaterial(materialId);
}

export async function deleteMaterialFile(fileId: string) {
  const { userId, treeId } = await requireMaterialContext("file.manage");
  const file = await prisma.mediaObject.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
      material: { treeId, deletedAt: null },
    },
    include: { material: { select: { id: true, title: true } } },
  });
  if (!file) throw new Error("文件不存在");

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const batch = await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "material_file_delete",
      summary: {
        materialId: file.material.id,
        materialTitle: file.material.title,
        fileId: file.id,
        originalName: file.originalName,
      },
      entries: [
        {
          entityType: "media_object",
          entityId: file.id,
          action: "delete",
          beforeJson: {
            materialId: file.material.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            contentHash: file.contentHash,
          },
        },
      ],
    });
    await tx.mediaObject.update({
      where: { id: file.id },
      data: {
        deletedAt: now,
        deletedBy: userId,
        deletionOperationId: batch.batchId,
      },
    });
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${file.material.id}`);
}

export async function previewMaterialDeletion(materialId: string) {
  const { userId, treeId } = await requireMaterialContext("content.delete");
  const material = await prisma.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null }, include: { files: { where: { deletedAt: null }, select: { id: true } }, links: { where: { deletedAt: null }, select: { id: true } } } });
  if (!material) throw new Error("资料不存在");
  const revision = await getTreeRevision(prisma, treeId);
  const preview = { material: { id: material.id, title: material.title }, affected: { fileCount: material.files.length, linkCount: material.links.length }, revision };
  const confirmationId = await createConfirmation(prisma, { treeId, userId, kind: "material_delete", input: { materialId }, revision, previewResult: preview });
  return { preview, confirmationId };
}

export async function deleteMaterial(confirmationId: string, materialId: string) {
  const { userId, treeId } = await requireMaterialContext("content.delete");
  await prisma.$transaction(async (tx) => {
    const revision = await getTreeRevision(tx, treeId);
    await consumeConfirmation(tx, { confirmationId, treeId, userId, kind: "material_delete", input: { materialId }, currentRevision: revision });
    const material = await tx.sourceMaterial.findFirst({ where: { id: materialId, treeId, deletedAt: null }, include: { files: { where: { deletedAt: null } }, links: { where: { deletedAt: null } } } });
    if (!material) throw new Error("资料不存在");
    const now = new Date();
    const batch = await createAuditBatch(tx, {
      treeId,
      actorId: userId,
      action: "material_delete",
      summary: { materialId, title: material.title, fileCount: material.files.length, linkCount: material.links.length },
      entries: [
        { entityType: "source_material", entityId: materialId, action: "delete", beforeJson: { title: material.title, category: material.category } },
        ...material.files.map((file) => ({ entityType: "media_object" as const, entityId: file.id, action: "delete" as const })),
        ...material.links.map((link) => ({ entityType: "material_link" as const, entityId: link.id, action: "delete" as const })),
      ],
    });
    const deleted = { deletedAt: now, deletedBy: userId, deletionOperationId: batch.batchId };
    await tx.sourceMaterial.update({ where: { id: materialId }, data: deleted });
    await tx.mediaObject.updateMany({ where: { materialId, deletedAt: null }, data: deleted });
    await tx.materialLink.updateMany({ where: { materialId, deletedAt: null }, data: deleted });
  });
  revalidatePath("/documents");
  revalidatePath("/person/[id]", "page");
}

export async function restoreMaterialDeletion(batchId: string) {
  const { userId, treeId } = await requireMaterialContext("recovery.manage");
  const batch = await prisma.operationBatch.findFirst({ where: { id: batchId, treeId, action: "material_delete", status: "complete" }, include: { entries: true } });
  if (!batch) throw new Error("资料删除批次不存在或不可恢复");
  const materialEntry = batch.entries.find((entry) => entry.entityType === "source_material");
  if (!materialEntry) throw new Error("资料删除批次不完整");
  const files = await prisma.mediaObject.findMany({ where: { deletionOperationId: batchId }, select: { storageKey: true } });
  const storage = getObjectStorage();
  const availability = await Promise.all(files.map((file) => storage.exists(file.storageKey)));
  if (availability.some((exists) => !exists)) throw new Error("资料原始文件缺失，无法完整恢复");

  await prisma.$transaction(async (tx) => {
    const material = await tx.sourceMaterial.findFirst({ where: { id: materialEntry.entityId, treeId, deletionOperationId: batchId } });
    if (!material) throw new Error("资料删除批次不属于当前家谱");
    const restored = { deletedAt: null, deletedBy: null, deletionOperationId: null };
    await tx.sourceMaterial.update({ where: { id: material.id }, data: restored });
    await tx.mediaObject.updateMany({ where: { materialId: material.id, deletionOperationId: batchId }, data: restored });
    await tx.materialLink.updateMany({ where: { materialId: material.id, deletionOperationId: batchId }, data: restored });
    await tx.operationBatch.update({ where: { id: batchId }, data: { status: "restored" } });
    await createAuditBatch(tx, { treeId, actorId: userId, action: "material_restore", summary: { materialId: material.id, restoredBatchId: batchId }, entries: [{ entityType: "source_material", entityId: material.id, action: "restore" }] });
  });
  revalidatePath("/documents");
  revalidatePath("/person/[id]", "page");
}

export async function getAuthorizedMediaObject(fileId: string) {
  const { treeId } = await requireMaterialContext();
  const file = await prisma.mediaObject.findFirst({ where: { id: fileId, deletedAt: null, material: { treeId, deletedAt: null } } });
  if (!file) throw new Error("文件不存在");
  return file;
}

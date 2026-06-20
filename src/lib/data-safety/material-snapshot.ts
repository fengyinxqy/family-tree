import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { MATERIAL_CATEGORIES } from "@/lib/materials/validation";
import { familyBackupSchema, type FamilyBackupDocument } from "@/lib/import-export/backup-format";

const snapshotMaterialSchema = z.object({
  id: z.string(), title: z.string(), category: z.enum(MATERIAL_CATEGORIES), source: z.string().nullable(), eraLabel: z.string().nullable(), contributor: z.string().nullable(), description: z.string().nullable(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
const snapshotFileSchema = z.object({
  id: z.string(), materialId: z.string(), originalName: z.string(), mimeType: z.string(), byteSize: z.number().int().positive(), contentHash: z.string(), storageKey: z.string(), displayOrder: z.number().int(), createdAt: z.string().datetime(),
});
const snapshotLinkSchema = z.object({
  id: z.string(), materialId: z.string(), personId: z.string().nullable(), personEventId: z.string().nullable(),
});

const materialSnapshotSchema = familyBackupSchema.extend({
  snapshotVersion: z.literal(2),
  materials: z.array(snapshotMaterialSchema),
  mediaObjects: z.array(snapshotFileSchema),
  materialLinks: z.array(snapshotLinkSchema),
});

export type MaterialSnapshotDocument = z.infer<typeof materialSnapshotSchema>;

export async function buildMaterialSnapshotDocument(userId: string, treeId: string, backup: FamilyBackupDocument): Promise<MaterialSnapshotDocument> {
  const materials = await prisma.sourceMaterial.findMany({
    where: { treeId, deletedAt: null },
    include: { files: { where: { deletedAt: null } }, links: { where: { deletedAt: null } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return {
    ...backup,
    snapshotVersion: 2,
    materials: materials.map((material) => ({ id: material.id, title: material.title, category: material.category, source: material.source, eraLabel: material.eraLabel, contributor: material.contributor, description: material.description, createdAt: material.createdAt.toISOString(), updatedAt: material.updatedAt.toISOString() })),
    mediaObjects: materials.flatMap((material) => material.files.map((file) => ({ id: file.id, materialId: material.id, originalName: file.originalName, mimeType: file.mimeType, byteSize: file.byteSize, contentHash: file.contentHash, storageKey: file.storageKey, displayOrder: file.displayOrder, createdAt: file.createdAt.toISOString() }))),
    materialLinks: materials.flatMap((material) => material.links.map((link) => ({ id: link.id, materialId: material.id, personId: link.personId, personEventId: link.personEventId }))),
  };
}

export function validateMaterialSnapshotDocument(input: unknown): MaterialSnapshotDocument {
  const parsed = materialSnapshotSchema.safeParse(input);
  if (!parsed.success) throw new Error("快照资料结构无效或版本过旧");
  const materialIds = new Set(parsed.data.materials.map((item) => item.id));
  if (parsed.data.mediaObjects.some((item) => !materialIds.has(item.materialId)) || parsed.data.materialLinks.some((item) => !materialIds.has(item.materialId))) throw new Error("快照资料引用无效");
  return parsed.data;
}

export async function assertSnapshotFileObjectsAvailable(document: MaterialSnapshotDocument) {
  const storage = getObjectStorage();
  const availability = await Promise.all(document.mediaObjects.map((file) => storage.exists(file.storageKey)));
  const missing = document.mediaObjects.filter((_, index) => !availability[index]);
  if (missing.length) throw new Error(`快照缺少 ${missing.length} 个原始文件对象，无法恢复`);
}

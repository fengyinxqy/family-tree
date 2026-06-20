import { createHash } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { MATERIAL_CATEGORIES } from "@/lib/materials/validation";
import { validateFileBytes } from "@/lib/materials/file-validation";
import { backupEventSchema, backupPersonSchema, backupRelationshipSchema } from "./backup-format";

export const FAMILY_EXCHANGE_KIND = "family-exchange-package";
export const FAMILY_EXCHANGE_VERSION = 2;
export const EXCHANGE_MAX_ENTRIES = 250;
export const EXCHANGE_MAX_EXPANDED_BYTES = 100 * 1024 * 1024;

const exchangeFileSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  path: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

const exchangeMaterialSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(MATERIAL_CATEGORIES),
  source: z.string().nullable(),
  eraLabel: z.string().nullable(),
  contributor: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const exchangeLinkSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  personId: z.string().nullable(),
  personEventId: z.string().nullable(),
}).refine((link) => Number(Boolean(link.personId)) + Number(Boolean(link.personEventId)) === 1, "资料关联必须且只能包含一个目标");

export const familyExchangeManifestSchema = z.object({
  kind: z.literal(FAMILY_EXCHANGE_KIND),
  version: z.literal(FAMILY_EXCHANGE_VERSION),
  exportedAt: z.string().datetime(),
  persons: z.array(backupPersonSchema),
  relationships: z.array(backupRelationshipSchema),
  events: z.array(backupEventSchema),
  materials: z.array(exchangeMaterialSchema),
  files: z.array(exchangeFileSchema),
  links: z.array(exchangeLinkSchema),
  summary: z.object({
    personCount: z.number().int().nonnegative(),
    relationshipCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    materialCount: z.number().int().nonnegative(),
    fileCount: z.number().int().nonnegative(),
  }),
});

export type FamilyExchangeManifest = z.infer<typeof familyExchangeManifestSchema>;

function isUnsafeArchivePath(name: string) {
  return name.startsWith("/") || name.startsWith("\\") || /^[a-zA-Z]:/.test(name) || name.split(/[\\/]/).includes("..");
}

export function inspectZipCentralDirectory(bytes: Uint8Array) {
  if (bytes.byteLength < 22) throw new Error("交换包不是有效的 ZIP 文件");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("交换包缺少 ZIP 目录");
  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entryCount > EXCHANGE_MAX_ENTRIES) throw new Error("交换包文件数量超过限制");

  const names = new Set<string>();
  let totalExpanded = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("交换包 ZIP 目录损坏");
    const expandedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replaceAll("\\", "/");
    if (!name || isUnsafeArchivePath(name)) throw new Error("交换包包含不安全路径");
    if (names.has(name)) throw new Error("交换包包含重复路径");
    names.add(name);
    totalExpanded += expandedSize;
    if (totalExpanded > EXCHANGE_MAX_EXPANDED_BYTES) throw new Error("交换包展开大小超过限制");
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { names, totalExpanded, entryCount };
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`交换包包含重复的${label}标识`);
}

export function parseFamilyExchangePackage(bytes: Uint8Array) {
  inspectZipCentralDirectory(bytes);
  const entries = unzipSync(bytes);
  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) throw new Error("交换包缺少 manifest.json");
  let input: unknown;
  try { input = JSON.parse(strFromU8(manifestBytes)); } catch { throw new Error("交换包清单不是有效 JSON"); }
  const parsed = familyExchangeManifestSchema.safeParse(input);
  if (!parsed.success) throw new Error("交换包清单格式无效");
  const manifest = parsed.data;

  assertUnique(manifest.persons.map((item) => item.id), "人物");
  assertUnique(manifest.relationships.map((item) => item.id), "关系");
  assertUnique(manifest.events.map((item) => item.id), "事件");
  assertUnique(manifest.materials.map((item) => item.id), "资料");
  assertUnique(manifest.files.map((item) => item.id), "文件");
  assertUnique(manifest.links.map((item) => item.id), "关联");

  const personIds = new Set(manifest.persons.map((item) => item.id));
  const eventIds = new Set(manifest.events.map((item) => item.id));
  const materialIds = new Set(manifest.materials.map((item) => item.id));
  for (const relationship of manifest.relationships) if (!personIds.has(relationship.personAId) || !personIds.has(relationship.personBId)) throw new Error("交换包关系引用了不存在的人物");
  for (const event of manifest.events) if (!personIds.has(event.personId)) throw new Error("交换包事件引用了不存在的人物");
  for (const link of manifest.links) {
    if (!materialIds.has(link.materialId) || (link.personId && !personIds.has(link.personId)) || (link.personEventId && !eventIds.has(link.personEventId))) throw new Error("交换包资料关联引用无效");
  }

  const payloads = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    if (!materialIds.has(file.materialId) || !file.path.startsWith("files/") || isUnsafeArchivePath(file.path)) throw new Error("交换包文件清单引用无效");
    const payload = entries[file.path];
    if (!payload) throw new Error(`交换包缺少文件：${file.path}`);
    const verified = validateFileBytes({ bytes: payload, declaredMimeType: file.mimeType, filename: file.originalName });
    if (verified.byteSize !== file.byteSize || verified.contentHash !== file.contentHash) throw new Error(`交换包文件校验失败：${file.originalName}`);
    payloads.set(file.id, payload);
  }
  return { manifest, payloads, packageHash: createHash("sha256").update(bytes).digest("hex") };
}

export function createFamilyExchangeZip(manifest: FamilyExchangeManifest, payloads: Map<string, Uint8Array>) {
  const entries: Record<string, Uint8Array> = { "manifest.json": strToU8(JSON.stringify(manifest, null, 2)) };
  for (const file of manifest.files) {
    const payload = payloads.get(file.id);
    if (!payload) throw new Error(`缺少导出文件：${file.originalName}`);
    entries[file.path] = payload;
  }
  return zipSync(entries, { level: 6 });
}

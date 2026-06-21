import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { createConfirmation, getTreeRevision } from "@/lib/data-safety";
import { createFamilyExchangeZip, parseFamilyExchangePackage, type FamilyExchangeManifest } from "@/lib/import-export/exchange-package";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { createImportRevisionGroup } from "@/services/revision-group.service";

async function readableToBytes(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}

function stableId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(6, "0")}`;
}

export async function exportFamilyExchangePackageForUser(userId: string, treeId: string) {
  await authorizeFamilyAction(userId, treeId, "export.read");
  const [persons, relationships, events, materials] = await Promise.all([
    prisma.person.findMany({ where: { treeId, deletedAt: null, withdrawnAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.relationship.findMany({ where: { deletedAt: null, withdrawnAt: null, personA: { treeId, deletedAt: null, withdrawnAt: null }, personB: { treeId, deletedAt: null, withdrawnAt: null } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.personEvent.findMany({ where: { withdrawnAt: null, person: { treeId, deletedAt: null, withdrawnAt: null } }, orderBy: [{ personId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.sourceMaterial.findMany({ where: { treeId, deletedAt: null, withdrawnAt: null }, include: { files: { where: { deletedAt: null, withdrawnAt: null }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }, links: { where: { deletedAt: null, withdrawnAt: null } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);

  const personIds = new Map(persons.map((person, index) => [person.id, stableId("person", index)]));
  const eventIds = new Map(events.map((event, index) => [event.id, stableId("event", index)]));
  const materialIds = new Map(materials.map((material, index) => [material.id, stableId("material", index)]));
  const storage = getObjectStorage();
  const payloads = new Map<string, Uint8Array>();
  const files: FamilyExchangeManifest["files"] = [];
  let fileIndex = 0;
  for (const material of materials) {
    for (const file of material.files) {
      const id = stableId("file", fileIndex++);
      let payload: Uint8Array;
      try { payload = await readableToBytes(await storage.open(file.storageKey)); } catch { throw new Error(`资料文件不可用，无法生成完整备份：${file.originalName}`); }
      payloads.set(id, payload);
      files.push({ id, materialId: materialIds.get(material.id)!, path: `files/${id}`, originalName: file.originalName, mimeType: file.mimeType, byteSize: file.byteSize, contentHash: file.contentHash, displayOrder: file.displayOrder, createdAt: file.createdAt.toISOString() });
    }
  }

  let linkIndex = 0;
  const links = materials.flatMap((material) => material.links.flatMap((link) => {
    const personId = link.personId ? personIds.get(link.personId) : null;
    const personEventId = link.personEventId ? eventIds.get(link.personEventId) : null;
    if (!personId && !personEventId) return [];
    return [{ id: stableId("link", linkIndex++), materialId: materialIds.get(material.id)!, personId: personId ?? null, personEventId: personEventId ?? null }];
  }));

  const manifest: FamilyExchangeManifest = {
    kind: "family-exchange-package",
    version: 2,
    exportedAt: new Date().toISOString(),
    persons: persons.map((person) => ({ id: personIds.get(person.id)!, name: person.name, gender: person.gender as "male" | "female", birthDate: person.birthDate, deathDate: person.deathDate, bio: person.bio, aliases: person.aliases, generationNumber: person.generationNumber, generationLabel: person.generationLabel, nativePlace: person.nativePlace, notes: person.notes, posX: person.posX, posY: person.posY, createdAt: person.createdAt.toISOString() })),
    relationships: relationships.map((relationship, index) => ({ id: stableId("relationship", index), type: relationship.type as "spouse" | "child", personAId: personIds.get(relationship.personAId)!, personBId: personIds.get(relationship.personBId)!, label: relationship.label, sortOrder: relationship.sortOrder, createdAt: relationship.createdAt.toISOString() })),
    events: events.map((event) => ({ id: eventIds.get(event.id)!, personId: personIds.get(event.personId)!, type: event.type as "birth" | "death" | "marriage" | "migration" | "other", title: event.title, dateLabel: event.dateLabel, location: event.location, description: event.description, sortOrder: event.sortOrder, createdAt: event.createdAt.toISOString() })),
    materials: materials.map((material) => ({ id: materialIds.get(material.id)!, title: material.title, category: material.category, source: material.source, eraLabel: material.eraLabel, contributor: material.contributor, description: material.description, createdAt: material.createdAt.toISOString(), updatedAt: material.updatedAt.toISOString() })),
    files,
    links,
    summary: { personCount: persons.length, relationshipCount: relationships.length, eventCount: events.length, materialCount: materials.length, fileCount: files.length },
  };
  return createFamilyExchangeZip(manifest, payloads);
}

export async function previewFamilyExchangeImport(userId: string, treeId: string, bytes: Uint8Array) {
  await authorizeFamilyAction(userId, treeId, "import.prepare");
  const { manifest, packageHash } = parseFamilyExchangePackage(bytes);
  const revision = await getTreeRevision(prisma, treeId);
  const preview = { summary: { totalPersons: manifest.persons.length, totalRelationships: manifest.relationships.length, totalEvents: manifest.events.length, totalMaterials: manifest.materials.length, totalFiles: manifest.files.length }, warnings: [], conflicts: [], valid: true, revision };
  const confirmationId = await createConfirmation(prisma, { treeId, userId, kind: "import", input: { packageHash }, revision, previewResult: preview });
  return { preview, confirmationId };
}

export async function executeFamilyExchangeImport(userId: string, treeId: string, confirmationId: string, bytes: Uint8Array) {
  await authorizeFamilyAction(userId, treeId, "import.execute");
  const { manifest, payloads, packageHash } = parseFamilyExchangePackage(bytes);
  const storage = getObjectStorage();
  const finalizedKeys: string[] = [];
  try {
    const storedFiles: Record<string, string> = {};
    for (const file of manifest.files) {
      const staged = await storage.stage(payloads.get(file.id)!);
      const storageKey = await storage.finalize(staged.temporaryKey);
      storedFiles[file.id] = storageKey;
      finalizedKeys.push(storageKey);
    }
    return await createImportRevisionGroup({
      userId,
      treeId,
      confirmationId,
      confirmationInput: { packageHash },
      source: {
        kind: "FAMILY_IMPORT",
        format: "EXCHANGE",
        sourceTextHash: packageHash,
        safeExcerpt: `家族交换包，导出于 ${manifest.exportedAt}`,
        capturedAt: new Date().toISOString(),
        document: manifest,
        storedFiles,
      },
    });
  } catch (error) {
    await Promise.all(finalizedKeys.map((key) => storage.remove(key).catch(() => undefined)));
    throw error;
  }
}

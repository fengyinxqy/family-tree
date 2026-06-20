import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { createAuditBatch, createConfirmation, consumeConfirmation, getTreeRevision } from "@/lib/data-safety";
import { createFamilyExchangeZip, parseFamilyExchangePackage, type FamilyExchangeManifest } from "@/lib/import-export/exchange-package";
import { exportFamilyBackupForUser } from "@/services/import-export.service";
import { buildRestorePayloads } from "@/lib/import-export/backup-format";
import { buildMaterialSnapshotDocument } from "@/lib/data-safety/material-snapshot";

async function readableToBytes(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}

function stableId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(6, "0")}`;
}

export async function exportFamilyExchangePackageForUser(userId: string, treeId: string) {
  const [persons, relationships, events, materials] = await Promise.all([
    prisma.person.findMany({ where: { createdBy: userId, treeId, deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.relationship.findMany({ where: { deletedAt: null, personA: { createdBy: userId, treeId, deletedAt: null }, personB: { deletedAt: null } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.personEvent.findMany({ where: { person: { createdBy: userId, treeId, deletedAt: null } }, orderBy: [{ personId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.sourceMaterial.findMany({ where: { createdBy: userId, treeId, deletedAt: null }, include: { files: { where: { deletedAt: null }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }, links: { where: { deletedAt: null } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
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
  const { manifest, packageHash } = parseFamilyExchangePackage(bytes);
  const revision = await getTreeRevision(prisma, treeId);
  const preview = { summary: { totalPersons: manifest.persons.length, totalRelationships: manifest.relationships.length, totalEvents: manifest.events.length, totalMaterials: manifest.materials.length, totalFiles: manifest.files.length }, warnings: [], conflicts: [], valid: true, revision };
  const confirmationId = await createConfirmation(prisma, { treeId, userId, kind: "import", input: { packageHash }, revision, previewResult: preview });
  return { preview, confirmationId };
}

export async function executeFamilyExchangeImport(userId: string, treeId: string, confirmationId: string, bytes: Uint8Array) {
  const { manifest, payloads, packageHash } = parseFamilyExchangePackage(bytes);
  const storage = getObjectStorage();
  const stagedKeys = new Map<string, string>();
  const finalizedKeys: string[] = [];
  try {
    for (const file of manifest.files) {
      const staged = await storage.stage(payloads.get(file.id)!);
      const storageKey = await storage.finalize(staged.temporaryKey);
      stagedKeys.set(file.id, storageKey);
      finalizedKeys.push(storageKey);
    }

    const currentBackup = await exportFamilyBackupForUser(userId, treeId);
    const currentSnapshot = await buildMaterialSnapshotDocument(userId, treeId, currentBackup);
    const result = await prisma.$transaction(async (tx) => {
      const revision = await getTreeRevision(tx, treeId);
      await consumeConfirmation(tx, { confirmationId, treeId, userId, kind: "import", input: { packageHash }, currentRevision: revision });
      await tx.familySnapshot.create({ data: { treeId, reason: "pre_import", version: 2, sourceRevision: revision, creatorId: userId, snapshotJson: currentSnapshot, personCount: currentBackup.persons.length, relationshipCount: currentBackup.relationships.length, eventCount: currentBackup.events.length, materialCount: currentSnapshot.materials.length, fileCount: currentSnapshot.mediaObjects.length } });

      await tx.sourceMaterial.deleteMany({ where: { treeId } });
      await tx.relationship.deleteMany({ where: { personA: { treeId } } });
      await tx.personEvent.deleteMany({ where: { person: { treeId } } });
      await tx.person.deleteMany({ where: { treeId } });

      const personIdMap = new Map<string, string>();
      for (const person of manifest.persons) {
        const created = await tx.person.create({ data: { name: person.name, gender: person.gender, birthDate: person.birthDate, deathDate: person.deathDate, bio: person.bio, aliases: person.aliases, generationNumber: person.generationNumber, generationLabel: person.generationLabel, nativePlace: person.nativePlace, notes: person.notes, posX: person.posX, posY: person.posY, createdAt: new Date(person.createdAt), createdBy: userId, treeId } });
        personIdMap.set(person.id, created.id);
      }
      const restorePayloads = buildRestorePayloads({ kind: "family-backup", version: 1, exportedAt: manifest.exportedAt, summary: { personCount: manifest.persons.length, relationshipCount: manifest.relationships.length, eventCount: manifest.events.length }, persons: manifest.persons, relationships: manifest.relationships, events: manifest.events }, personIdMap);
      if (restorePayloads.relationships.length) await tx.relationship.createMany({ data: restorePayloads.relationships });

      const eventIdMap = new Map<string, string>();
      for (const event of manifest.events) {
        const created = await tx.personEvent.create({ data: { personId: personIdMap.get(event.personId)!, type: event.type, title: event.title, dateLabel: event.dateLabel, location: event.location, description: event.description, sortOrder: event.sortOrder, createdAt: new Date(event.createdAt) } });
        eventIdMap.set(event.id, created.id);
      }

      const materialIdMap = new Map<string, string>();
      for (const material of manifest.materials) {
        const created = await tx.sourceMaterial.create({ data: { treeId, createdBy: userId, title: material.title, category: material.category, source: material.source, eraLabel: material.eraLabel, contributor: material.contributor, description: material.description, createdAt: new Date(material.createdAt), updatedAt: new Date(material.updatedAt) } });
        materialIdMap.set(material.id, created.id);
      }
      if (manifest.files.length) await tx.mediaObject.createMany({ data: manifest.files.map((file) => ({ materialId: materialIdMap.get(file.materialId)!, originalName: file.originalName, mimeType: file.mimeType, byteSize: file.byteSize, contentHash: file.contentHash, storageKey: stagedKeys.get(file.id)!, displayOrder: file.displayOrder, createdAt: new Date(file.createdAt) })) });
      if (manifest.links.length) await tx.materialLink.createMany({ data: manifest.links.map((link) => ({ materialId: materialIdMap.get(link.materialId)!, personId: link.personId ? personIdMap.get(link.personId)! : null, personEventId: link.personEventId ? eventIdMap.get(link.personEventId)! : null })) });
      await createAuditBatch(tx, { treeId, actorId: userId, action: "import", summary: manifest.summary, entries: [] });
      return manifest.summary;
    });
    return result;
  } catch (error) {
    await Promise.all(finalizedKeys.map((key) => storage.remove(key).catch(() => undefined)));
    throw error;
  }
}

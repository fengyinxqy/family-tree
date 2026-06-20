"use server";

import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import {
  createAuditBatch,
  createConfirmation,
  consumeConfirmation,
  getTreeRevision,
  activePersonInTree,
} from "@/lib/data-safety";
import {
  validateFamilyBackupDocument,
  buildRestorePayloads,
} from "@/lib/import-export/backup-format";
import { createImportExportService } from "@/services/import-export-core";

const { exportFamilyBackupForUser } = createImportExportService({
  prisma,
  revalidatePath,
});

export interface SnapshotListItem {
  id: string;
  reason: string;
  version: number;
  sourceRevision: number;
  personCount: number;
  relationshipCount: number;
  eventCount: number;
  createdAt: Date;
}

export async function createSnapshot(reason: "manual" | "pre_import" | "pre_restore") {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  const backup = await exportFamilyBackupForUser(userId, activeTree.id);

  const result = await prisma.$transaction(async (tx) => {
    const revision = await getTreeRevision(tx, activeTree.id);
    const snapshot = await tx.familySnapshot.create({
      data: {
        treeId: activeTree.id,
        reason,
        version: 1,
        sourceRevision: revision,
        creatorId: userId,
        snapshotJson: backup as Prisma.InputJsonValue,
        personCount: backup.persons.length,
        relationshipCount: backup.relationships.length,
        eventCount: backup.events.length,
      },
    });
    await createAuditBatch(tx, {
      treeId: activeTree.id,
      actorId: userId,
      action: "snapshot_restore",
      summary: { snapshotId: snapshot.id, reason, personCount: backup.persons.length },
      entries: [{ entityType: "snapshot", entityId: snapshot.id, action: "snapshot_create", afterJson: { reason, personCount: backup.persons.length } }],
    });
    return snapshot;
  });
  return result;
}

export async function getSnapshotList(): Promise<SnapshotListItem[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  return prisma.familySnapshot.findMany({
    where: { treeId: activeTree.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, version: true, sourceRevision: true, personCount: true, relationshipCount: true, eventCount: true, createdAt: true },
    take: 50,
  });
}

export async function previewImport(input: unknown) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  const document = validateFamilyBackupDocument(input);
  const personIds = new Set(document.persons.map((p) => p.id));
  const duplicateIds = document.persons.filter((p, i) => document.persons.findIndex((q) => q.id === p.id) < i).map((p) => p.id);
  const brokenRefs = document.relationships.filter((r) => !personIds.has(r.personAId) || !personIds.has(r.personBId));
  const brokenEvents = document.events.filter((e) => !personIds.has(e.personId));
  const currentPersons = await prisma.person.findMany({ where: activePersonInTree(userId, activeTree.id), select: { id: true, name: true } });
  const currentPersonIds = new Set(currentPersons.map((p) => p.id));
  const newPersons = document.persons.filter((p) => !currentPersonIds.has(p.id));
  const replacedPersons = document.persons.filter((p) => currentPersonIds.has(p.id));
  const removedPersons = currentPersons.filter((p) => !personIds.has(p.id));
  const warnings: string[] = [];
  const conflicts: string[] = [];
  for (const rel of document.relationships) {
    if (rel.personAId === rel.personBId) conflicts.push(`自关联关系: ${rel.personAId}`);
  }
  if (duplicateIds.length > 0) conflicts.push(`重复人物ID: ${duplicateIds.join(", ")}`);
  if (brokenRefs.length > 0) conflicts.push(`${brokenRefs.length}个关系引用不存在的人物`);
  if (brokenEvents.length > 0) conflicts.push(`${brokenEvents.length}个事件引用不存在的人物`);
  const revision = await getTreeRevision(prisma, activeTree.id);
  const previewResult = {
    summary: { totalPersons: document.persons.length, totalRelationships: document.relationships.length, totalEvents: document.events.length, newPersons: newPersons.length, replacedPersons: replacedPersons.length, removedPersons: removedPersons.length },
    warnings, conflicts, valid: conflicts.length === 0, revision,
  };
  if (!previewResult.valid) return { preview: previewResult, confirmationId: null };
  const confirmationId = await createConfirmation(prisma, { treeId: activeTree.id, userId, kind: "import", input, revision, previewResult: previewResult as Record<string, unknown> });
  return { preview: previewResult, confirmationId };
}

export async function executeImport(confirmationId: string, input: unknown) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  const result = await prisma.$transaction(async (tx) => {
    const currentRevision = await getTreeRevision(tx, activeTree.id);
    await consumeConfirmation(tx, { confirmationId, treeId: activeTree.id, userId, kind: "import", input, currentRevision });
    const backup = await exportFamilyBackupForUser(userId, activeTree.id);
    await tx.familySnapshot.create({ data: { treeId: activeTree.id, reason: "pre_import", version: 1, sourceRevision: currentRevision, creatorId: userId, snapshotJson: backup as Prisma.InputJsonValue, personCount: backup.persons.length, relationshipCount: backup.relationships.length, eventCount: backup.events.length } });
    const document = validateFamilyBackupDocument(input);
    await tx.relationship.deleteMany({ where: { personA: { createdBy: userId, treeId: activeTree.id } } });
    await tx.personEvent.deleteMany({ where: { person: { createdBy: userId, treeId: activeTree.id } } });
    await tx.person.deleteMany({ where: { createdBy: userId, treeId: activeTree.id } });
    const personIdMap = new Map<string, string>();
    for (const person of document.persons) {
      const created = await tx.person.create({ data: { name: person.name, gender: person.gender, birthDate: person.birthDate, deathDate: person.deathDate, bio: person.bio, aliases: person.aliases, generationNumber: person.generationNumber, generationLabel: person.generationLabel, nativePlace: person.nativePlace, notes: person.notes, posX: person.posX, posY: person.posY, createdAt: new Date(person.createdAt), createdBy: userId, treeId: activeTree.id } });
      personIdMap.set(person.id, created.id);
    }
    const restorePayloads = buildRestorePayloads(document, personIdMap);
    if (restorePayloads.relationships.length > 0) await tx.relationship.createMany({ data: restorePayloads.relationships });
    if (restorePayloads.events.length > 0) await tx.personEvent.createMany({ data: restorePayloads.events });
    await createAuditBatch(tx, { treeId: activeTree.id, actorId: userId, action: "import", summary: { personCount: document.persons.length }, entries: [] });
    return { personCount: document.persons.length, relationshipCount: document.relationships.length, eventCount: document.events.length };
  });
  revalidatePath("/tree");
  return result;
}

export async function previewSnapshotRestore(snapshotId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  const snapshot = await prisma.familySnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot || snapshot.treeId !== activeTree.id) throw new Error("快照不存在或不属于当前家谱");
  const document = validateFamilyBackupDocument(snapshot.snapshotJson as unknown);
  const revision = await getTreeRevision(prisma, activeTree.id);
  const preview = {
    ...snapshot,
    preview: {
      personCount: document.persons.length,
      relationshipCount: document.relationships.length,
      eventCount: document.events.length,
      createdAt: snapshot.createdAt,
      sourceRevision: snapshot.sourceRevision,
      currentRevision: revision,
      warning: "恢复此快照将替换当前所有活跃数据，系统将自动创建当前状态的快照作为备份。",
    },
    revision,
  };
  const confirmationId = await createConfirmation(prisma, { treeId: activeTree.id, userId, kind: "snapshot_restore", input: { snapshotId }, revision, previewResult: preview as Record<string, unknown> });
  return { preview, confirmationId };
}

export async function executeSnapshotRestore(confirmationId: string, snapshotId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("未登录");
  const activeTree = await getActiveFamilyTreeForUser(userId, session.user?.name);
  const currentBackup = await exportFamilyBackupForUser(userId, activeTree.id);
  const currentRevision = await getTreeRevision(prisma, activeTree.id);
  await prisma.familySnapshot.create({ data: { treeId: activeTree.id, reason: "pre_restore", version: 1, sourceRevision: currentRevision, creatorId: userId, snapshotJson: currentBackup as Prisma.InputJsonValue, personCount: currentBackup.persons.length, relationshipCount: currentBackup.relationships.length, eventCount: currentBackup.events.length } });
  await prisma.$transaction(async (tx) => {
    const latestRevision = await getTreeRevision(tx, activeTree.id);
    await consumeConfirmation(tx, { confirmationId, treeId: activeTree.id, userId, kind: "snapshot_restore", input: { snapshotId }, currentRevision: latestRevision });
    const snapshot = await tx.familySnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot || snapshot.treeId !== activeTree.id) throw new Error("快照不存在或不属于当前家谱");
    const document = validateFamilyBackupDocument(snapshot.snapshotJson as unknown);
    await tx.relationship.deleteMany({ where: { personA: { createdBy: userId, treeId: activeTree.id } } });
    await tx.personEvent.deleteMany({ where: { person: { createdBy: userId, treeId: activeTree.id } } });
    await tx.person.deleteMany({ where: { createdBy: userId, treeId: activeTree.id } });
    const personIdMap = new Map<string, string>();
    for (const person of document.persons) {
      const created = await tx.person.create({ data: { name: person.name, gender: person.gender, birthDate: person.birthDate, deathDate: person.deathDate, bio: person.bio, aliases: person.aliases, generationNumber: person.generationNumber, generationLabel: person.generationLabel, nativePlace: person.nativePlace, notes: person.notes, posX: person.posX, posY: person.posY, createdAt: new Date(person.createdAt), createdBy: userId, treeId: activeTree.id } });
      personIdMap.set(person.id, created.id);
    }
    const restorePayloads = buildRestorePayloads(document, personIdMap);
    if (restorePayloads.relationships.length > 0) await tx.relationship.createMany({ data: restorePayloads.relationships });
    if (restorePayloads.events.length > 0) await tx.personEvent.createMany({ data: restorePayloads.events });
    await createAuditBatch(tx, { treeId: activeTree.id, actorId: userId, action: "snapshot_restore", summary: { snapshotId, reason: snapshot.reason }, entries: [] });
  });
  revalidatePath("/tree");
  revalidatePath("/settings");
}

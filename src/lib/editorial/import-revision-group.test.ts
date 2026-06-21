import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildFamilyBackupDocument } from "@/lib/import-export/backup-format";
import { createRevisionGroupSchema } from "./revision-groups";

const backup = buildFamilyBackupDocument({
  exportedAt: "2026-06-21T00:00:00.000Z",
  persons: [{
    id: "person-1", name: "张三", gender: "male", birthDate: null, deathDate: null, bio: null,
    aliases: [], generationNumber: 1, generationLabel: null, nativePlace: null, notes: null,
    posX: null, posY: null, createdAt: "2026-06-20T00:00:00.000Z",
  }],
  relationships: [],
  events: [],
});

void test("导入备份可创建零成员的不可变修订组，普通录入不可为空", () => {
  const source = {
    kind: "FAMILY_IMPORT" as const,
    format: "JSON" as const,
    sourceTextHash: "a".repeat(64),
    safeExcerpt: "JSON 备份",
    capturedAt: "2026-06-21T00:00:00.000Z",
    document: backup,
    storedFiles: {},
  };
  assert.equal(createRevisionGroupSchema.safeParse({ schemaVersion: 1, summary: "导入", source, members: [] }).success, true);
  assert.equal(createRevisionGroupSchema.safeParse({
    schemaVersion: 1,
    summary: "空录入",
    source: { schemaVersion: 1, sourceTextHash: "b".repeat(64), safeExcerpt: "口述", conversationRounds: 1, capturedAt: "2026-06-21T00:00:00.000Z" },
    members: [],
  }).success, false);
});

void test("确认导入只创建审校组，不直接写正式表", async () => {
  const [snapshotService, exchangeService] = await Promise.all([
    readFile(new URL("../../services/snapshot.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../../services/exchange-package.service.ts", import.meta.url), "utf8"),
  ]);
  const jsonExecute = snapshotService.match(/export async function executeImport[\s\S]*?\r?\n}\r?\n\r?\nexport async function previewSnapshotRestore/)?.[0] ?? "";
  const exchangeExecute = exchangeService.match(/export async function executeFamilyExchangeImport[\s\S]*?\r?\n}\s*$/)?.[0] ?? "";
  assert.match(jsonExecute, /createImportRevisionGroup/);
  assert.doesNotMatch(jsonExecute, /(?:person|relationship|personEvent)\.(?:create|delete)/);
  assert.match(exchangeExecute, /createImportRevisionGroup/);
  assert.doesNotMatch(exchangeExecute, /(?:person|relationship|personEvent|sourceMaterial)\.(?:create|delete)/);
});

void test("导入发布在 Serializable 事务中创建预快照、替换正式数据并写审计", async () => {
  const source = await readFile(new URL("../../services/revision-group.service.ts", import.meta.url), "utf8");
  const publishImport = source.match(/async function publishImportRevisionGroup[\s\S]*?\n}\n\nexport async function publishRevisionGroup/)?.[0] ?? "";
  assert.match(publishImport, /status !== "APPROVED"/);
  assert.match(publishImport, /TransactionIsolationLevel\.Serializable/);
  assert.match(publishImport, /familySnapshot\.create/);
  assert.match(publishImport, /sourceMaterial\.deleteMany/);
  assert.match(publishImport, /family_import_publish/);
  assert.match(publishImport, /status: "PUBLISHED"/);
});

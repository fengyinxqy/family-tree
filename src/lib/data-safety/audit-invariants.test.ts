import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAuditBatch, sanitizeAuditJson } from "./transaction-helpers";

void test("审计 JSON 递归脱敏令牌、凭证、存储键和业务 payload", () => {
  assert.deepEqual(sanitizeAuditJson({
    invitationId: "invite-1",
    token: "plaintext",
    nested: { tokenHash: "hash", storageKey: "private/key", payload: { biography: "private" } },
  }), {
    invitationId: "invite-1",
    token: "[REDACTED]",
    nested: { tokenHash: "[REDACTED]", storageKey: "[REDACTED]", payload: "[REDACTED]" },
  });
});

void test("审计批次保留完整 actor 归属并在条目写入失败时拒绝", async () => {
  let batchActorId: string | undefined;
  const tx = {
    familyTree: { update: async () => ({}) },
    operationBatch: {
      create: async ({ data }: { data: { actorId: string } }) => {
        batchActorId = data.actorId;
        return { id: "batch-1" };
      },
    },
    auditEntry: { create: async () => { throw new Error("audit unavailable"); } },
  };

  await assert.rejects(() => createAuditBatch(tx as never, {
    treeId: "tree-1",
    actorId: "user-1",
    action: "content_revision_publish",
    entries: [{ entityType: "content_revision", entityId: "revision-1", action: "publish" }],
  }), /audit unavailable/);
  assert.equal(batchActorId, "user-1");
});

void test("迁移在数据库层拒绝审计记录 UPDATE 与 DELETE", () => {
  const sql = readFileSync(
    new URL("../../../prisma/migrations/20260621120000_enforce_audit_append_only/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /BEFORE UPDATE OR DELETE ON "audit_entries"/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON "operation_batches"/);
});

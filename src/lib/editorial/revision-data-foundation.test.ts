import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRevisionGroupSchema } from "./revision-groups";
import { revisionProvenanceListSchema, validateRevisionProvenanceScope } from "./revision-provenance";

test("来源列表拒绝重复记录", () => {
  assert.equal(revisionProvenanceListSchema.safeParse([
    { kind: "MATERIAL", sourceMaterialId: "material-1" },
    { kind: "MATERIAL", sourceMaterialId: "material-1" },
  ]).success, false);
});

test("来源作用域拒绝跨家族资料", async () => {
  await assert.rejects(() => validateRevisionProvenanceScope({
    async sourceBelongsToTree(_kind, id, treeId) {
      return id === "material-1" && treeId === "tree-1";
    },
  }, "tree-1", [{ kind: "MEDIA_OBJECT", mediaObjectId: "foreign-media" }]));
});

test("修订组拒绝重复成员标识", () => {
  const result = createRevisionGroupSchema.safeParse({
    schemaVersion: 1,
    summary: "重复成员",
    source: { schemaVersion: 1, sourceTextHash: "b".repeat(64), safeExcerpt: "测试", conversationRounds: 0, capturedAt: "2026-06-20T12:00:00.000Z" },
    members: [
      { contentType: "PERSON", order: 0, tempRef: "tmp:same", payload: { name: "甲", gender: "male", evidence: "测试" } },
      { contentType: "PERSON", order: 1, tempRef: "tmp:same", payload: { name: "乙", gender: "female", evidence: "测试" } },
    ],
  });
  assert.equal(result.success, false);
});

test("迁移保持历史正式记录默认可见且不伪造来源", () => {
  const migration = readFileSync("prisma/migrations/20260620200000_add_revision_groups_provenance_withdrawal/migration.sql", "utf8");
  assert.match(migration, /withdrawal fields default to NULL/);
  assert.match(migration, /not assigned fabricated provenance/);
  assert.doesNotMatch(migration, /INSERT INTO "revision_provenance"/);
  assert.match(migration, /uq_revision_group_members_temp_ref/);
  assert.match(migration, /review_decisions_exactly_one_subject/);
  assert.match(migration, /revision_provenance_exactly_one_subject/);
});

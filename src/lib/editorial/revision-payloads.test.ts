import assert from "node:assert/strict";
import test from "node:test";
import {
  RevisionPayloadError,
  parseRevisionPayload,
  validateRevisionPayloadScope,
  type RevisionScopeRepository,
} from "./revision-payloads";

const validPayloads = {
  PERSON: { name: "张三", gender: "male", generationNumber: 1 },
  PERSON_EVENT: { personId: "person-1", type: "birth", sortOrder: 0 },
  RELATIONSHIP: { type: "child", personAId: "person-1", personBId: "person-2", sortOrder: 0 },
  SOURCE_MATERIAL: { title: "族谱", category: "genealogy" },
  MEDIA_OBJECT: { materialId: "material-1", stagedObjectId: "staged-1", originalName: "a.pdf", mimeType: "application/pdf", byteSize: 10, contentHash: "a".repeat(64), displayOrder: 0 },
  MATERIAL_LINK: { materialId: "material-1", targets: [{ personId: "person-1" }] },
  IMPORT_BATCH: { packageHash: "a".repeat(64), stagedPackageId: "package-1", summary: { personCount: 1, relationshipCount: 0, eventCount: 0, materialCount: 0, fileCount: 0 } },
} as const;

test("每种修订 payload 的 v1 schema 均可解析", () => {
  for (const [contentType, payload] of Object.entries(validPayloads)) {
    assert.doesNotThrow(() => parseRevisionPayload(contentType as keyof typeof validPayloads, 1, payload));
  }
});

test("拒绝未知版本与畸形关系", () => {
  assert.throws(() => parseRevisionPayload("PERSON", 2, validPayloads.PERSON), (error) => error instanceof RevisionPayloadError && error.code === "UNSUPPORTED_SCHEMA");
  assert.throws(
    () => parseRevisionPayload("RELATIONSHIP", 1, { type: "child", personAId: "same", personBId: "same" }),
    (error) => error instanceof RevisionPayloadError && error.code === "INVALID_PAYLOAD",
  );
});

test("资料关联必须且只能指定一个目标", () => {
  assert.throws(() => parseRevisionPayload("MATERIAL_LINK", 1, { materialId: "m1" }));
  assert.throws(() => parseRevisionPayload("MATERIAL_LINK", 1, { materialId: "m1", targets: [{ personId: "p1", personEventId: "e1" }] }));
});

test("跨家族引用返回统一作用域错误", async () => {
  const repository: RevisionScopeRepository = {
    async entityBelongsToTree(_type, id) { return id !== "person-2"; },
  };
  await assert.rejects(
    validateRevisionPayloadScope(repository, "tree-1", "RELATIONSHIP", 1, validPayloads.RELATIONSHIP),
    (error) => error instanceof RevisionPayloadError && error.code === "OUT_OF_SCOPE_REFERENCE",
  );
});

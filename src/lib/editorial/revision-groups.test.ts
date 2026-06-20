import assert from "node:assert/strict";
import test from "node:test";
import { assertRevisionGroupTransition, createRevisionGroupSchema } from "./revision-groups";

const source = {
  schemaVersion: 1 as const,
  sourceTextHash: "a".repeat(64),
  safeExcerpt: "张三是李四的父亲",
  conversationRounds: 1,
  capturedAt: "2026-06-20T12:00:00.000Z",
};

test("接受闭合且有序的 AI 修订组", () => {
  const parsed = createRevisionGroupSchema.parse({
    schemaVersion: 1,
    summary: "新增两个人物及父子关系",
    source,
    members: [
      { contentType: "PERSON", order: 0, tempRef: "tmp:person-a", payload: { name: "张三", gender: "male", evidence: "原文提及" } },
      { contentType: "PERSON", order: 1, tempRef: "tmp:person-b", payload: { name: "李四", gender: "male", evidence: "原文提及" } },
      { contentType: "RELATIONSHIP", order: 2, tempRef: "tmp:relationship-a", payload: { type: "child", personA: { kind: "TEMPORARY", tempRef: "tmp:person-a" }, personB: { kind: "TEMPORARY", tempRef: "tmp:person-b" }, evidence: "原文关系" } },
    ],
  });
  assert.equal(parsed.members.length, 3);
});

test("拒绝未定义临时引用和重复顺序", () => {
  const result = createRevisionGroupSchema.safeParse({
    schemaVersion: 1,
    summary: "无效组",
    source,
    members: [
      { contentType: "PERSON", order: 0, tempRef: "tmp:person-a", payload: { name: "张三", gender: "male", evidence: "原文提及" } },
      { contentType: "RELATIONSHIP", order: 0, tempRef: "tmp:relationship-a", payload: { type: "child", personA: { kind: "TEMPORARY", tempRef: "tmp:missing" }, personB: { kind: "TEMPORARY", tempRef: "tmp:person-a" }, evidence: "原文关系" } },
    ],
  });
  assert.equal(result.success, false);
});

test("修订组遵循严格状态机", () => {
  assert.doesNotThrow(() => assertRevisionGroupTransition("DRAFT", "IN_REVIEW"));
  assert.doesNotThrow(() => assertRevisionGroupTransition("IN_REVIEW", "APPROVED"));
  assert.throws(() => assertRevisionGroupTransition("DRAFT", "PUBLISHED"));
  assert.throws(() => assertRevisionGroupTransition("PUBLISHED", "DRAFT"));
});

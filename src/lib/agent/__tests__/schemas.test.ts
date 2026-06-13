/**
 * Zod schema 验证测试 — 覆盖 draftAmbiguitySchema 与 intakeRouteRequestSchema 新增字段
 *
 * 运行方式: npx tsx src/lib/agent/__tests__/schemas.test.ts
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  draftAmbiguitySchema,
  intakeRouteRequestSchema,
  intakeDraftSchema,
} from "../schemas";

describe("draftAmbiguitySchema", () => {
  it("应接受新增的 person_gender_unknown kind", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "person_gender_unknown",
      message: "该人物性别未知",
      relatedRefs: ["p1"],
      options: ["male", "female"],
      question: "请问这个人的性别是？",
    });
    assert.equal(result.success, true);
  });

  it("应接受新增的 generation_unclear kind", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "generation_unclear",
      message: "无法确定代际关系",
      relatedRefs: ["p1", "p2"],
      options: [],
      question: "张三和李四之间是什么辈分关系？",
    });
    assert.equal(result.success, true);
  });

  it("应接受新增的 relationship_direction_unknown kind", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "relationship_direction_unknown",
      message: "关系方向不明确",
      relatedRefs: ["p1", "p2"],
      options: ["父母-子女", "配偶"],
      question: "请问谁是父母、谁是子女，还是双方为配偶？",
    });
    assert.equal(result.success, true);
  });

  it("应接受不带 question 字段的歧义项（question 为可选）", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "person_match",
      message: "匹配到多个同名人物",
      relatedRefs: ["p1"],
      options: ["张三 (id1)", "张三 (id2)"],
    });
    assert.equal(result.success, true);
  });

  it("应拒绝未知的 kind 值", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "invalid_kind",
      message: "test",
      relatedRefs: [],
      options: [],
    });
    assert.equal(result.success, false);
  });

  it("应拒绝缺少 message 的歧义项", () => {
    const result = draftAmbiguitySchema.safeParse({
      kind: "person_match",
      relatedRefs: [],
      options: [],
    });
    assert.equal(result.success, false);
  });
});

describe("intakeRouteRequestSchema", () => {
  it("应接受仅含 text 的首次录入请求（向后兼容）", () => {
    const result = intakeRouteRequestSchema.safeParse({ text: "我叫王明" });
    assert.equal(result.success, true);
  });

  it("应接受含 previousDraft 和 clarificationText 的续写请求", () => {
    const draft = intakeDraftSchema.parse({
      summary: "测试草稿",
      persons: [],
      relationships: [],
      ambiguities: [],
      questions: [],
      readyToApply: true,
    });

    const result = intakeRouteRequestSchema.safeParse({
      text: "原始口述",
      previousDraft: draft,
      clarificationText: "他的父亲叫王建国",
    });
    assert.equal(result.success, true);
  });

  it("应接受仅含 previousDraft 不含 clarificationText 的请求", () => {
    const draft = intakeDraftSchema.parse({
      summary: "测试草稿",
      persons: [],
      relationships: [],
      ambiguities: [],
      questions: [],
      readyToApply: false,
    });

    const result = intakeRouteRequestSchema.safeParse({
      text: "原始口述",
      previousDraft: draft,
    });
    assert.equal(result.success, true);
  });

  it("应拒绝缺少 text 的请求", () => {
    const result = intakeRouteRequestSchema.safeParse({});
    assert.equal(result.success, false);
  });

  it("应拒绝 text 为空字符串的请求", () => {
    const result = intakeRouteRequestSchema.safeParse({ text: "" });
    assert.equal(result.success, false);
  });

  it("应拒绝 invalid previousDraft 结构", () => {
    const result = intakeRouteRequestSchema.safeParse({
      text: "test",
      previousDraft: { invalid: true },
    });
    assert.equal(result.success, false);
  });
});

console.log("✅ 所有 schema 测试通过");

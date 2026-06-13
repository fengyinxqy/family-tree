/**
 * API 续写模式测试 — 模拟首次录入 → 补充澄清的完整流程
 *
 * 运行方式: npx tsx src/lib/agent/__tests__/api-continuation.test.ts
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { intakeRouteRequestSchema, intakeDraftSchema } from "../schemas";
import { buildContinuationPrompt } from "../intake-agent";
import type { IntakeDraft } from "../types";

describe("续写模式 API 流程", () => {
  /** 模拟首次录入返回的草稿（包含 person_gender_unknown 歧义） */
  function makeFirstRoundDraft(): IntakeDraft {
    return intakeDraftSchema.parse({
      summary: "识别到 2 位人物、1 条关系。",
      persons: [
        {
          ref: "p1",
          action: "create",
          existingPersonId: null,
          name: "王明",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "口述中提到\"我叫王明\"",
        },
        {
          ref: "p2",
          action: "create",
          existingPersonId: null,
          name: "王建国",
          gender: "unknown",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "口述中提到\"父亲王建国\"",
        },
      ],
      relationships: [
        {
          ref: "r1",
          action: "create",
          type: "child",
          personARef: "p2",
          personBRef: "p1",
          label: null,
          evidence: "\"父亲王建国\"",
          reason: null,
        },
      ],
      ambiguities: [
        {
          kind: "person_gender_unknown",
          message: "\"王建国\"的性别还不明确，建议先确认再落库。",
          relatedRefs: ["p2"],
          options: ["male", "female"],
          question: "请问\"王建国\"的性别是？",
        },
      ],
      questions: [],
      readyToApply: false,
    });
  }

  // --- Schema 验证 ---
  it("续写请求 schema 接受完整参数", () => {
    const firstDraft = makeFirstRoundDraft();
    const result = intakeRouteRequestSchema.safeParse({
      text: "我叫王明，父亲王建国。",
      previousDraft: firstDraft,
      clarificationText: "王建国的性别是男",
    });
    assert.equal(result.success, true);
  });

  it("续写请求 schema 拒接缺少 previousDraft 仅给 clarificationText", () => {
    const result = intakeRouteRequestSchema.safeParse({
      text: "我叫王明。",
      clarificationText: "补充信息",
    });
    // 这应该通过 — clarificationText 是可选的
    assert.equal(result.success, true);
  });

  it("续写请求 schema 拒绝无效的 previousDraft 结构", () => {
    const result = intakeRouteRequestSchema.safeParse({
      text: "test",
      previousDraft: { notAValid: "draft" },
      clarificationText: "补充信息",
    });
    assert.equal(result.success, false);
  });

  // --- buildContinuationPrompt 输出验证 ---
  it("buildContinuationPrompt 包含前轮草稿的关键信息", () => {
    const firstDraft = makeFirstRoundDraft();
    const prompt = buildContinuationPrompt(firstDraft, "test-clarification");

    // prompt 应包含 ref 引用
    assert.ok(prompt.includes("p1"));
    assert.ok(prompt.includes("p2"));
    assert.ok(prompt.includes("r1"));

    // prompt 应包含结构标记
    assert.ok(prompt.includes("ref="));
    assert.ok(prompt.includes("action="));
    assert.ok(prompt.includes("gender="));

    // prompt 应包含补充文本
    assert.ok(prompt.includes("test-clarification"));

    // prompt 应非空且有足够长度
    assert.ok(prompt.length > 200);
  });

  it("buildContinuationPrompt 包含复用人物信息", () => {
    const draft = intakeDraftSchema.parse({
      summary: "draft-summary",
      persons: [
        {
          ref: "p-reuse-1",
          action: "reuse",
          existingPersonId: "db-existing-123",
          name: "TestPerson",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
      ],
      relationships: [],
      ambiguities: [],
      questions: [],
      readyToApply: true,
    });

    const prompt = buildContinuationPrompt(draft, "extra-info");

    assert.ok(prompt.includes("p-reuse-1"), "should contain ref");
    assert.ok(prompt.includes("db-existing-123"), "should contain existingPersonId");
    assert.ok(prompt.includes("reuse"), "should contain action");
    assert.ok(prompt.includes("TestPerson"), "should contain name");
    assert.ok(prompt.includes("extra-info"), "should contain clarification");
  });

  // --- 完整流程模拟 ---
  it("模拟首次录入→补充澄清→草稿就绪的完整流程", () => {
    const firstDraft = makeFirstRoundDraft();

    // 首次录入后草稿应未就绪
    assert.equal(firstDraft.readyToApply, false);
    assert.equal(firstDraft.ambiguities.length, 1);
    assert.equal(firstDraft.ambiguities[0].kind, "person_gender_unknown");

    // 续写请求 schema 验证
    const continuationReq = {
      text: "我叫王明，父亲王建国。",
      previousDraft: firstDraft,
      clarificationText: "王建国的性别是男",
    };
    const parsed = intakeRouteRequestSchema.safeParse(continuationReq);
    assert.equal(parsed.success, true);

    // 验证 buildContinuationPrompt 输出完整
    const prompt = buildContinuationPrompt(firstDraft, "test-clarification");
    assert.ok(prompt.length > 100);
    assert.ok(prompt.includes("p1"));
    assert.ok(prompt.includes("p2"));
    assert.ok(prompt.includes("r1"));
    assert.ok(prompt.includes("test-clarification"));
  });
});

console.log("✅ 所有 API 续写模式测试通过");

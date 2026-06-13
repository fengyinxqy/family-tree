/**
 * mergeDraftWithClarification 单元测试
 *
 * 运行方式: npx tsx src/lib/agent/__tests__/merge-draft.test.ts
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { mergeDraftWithClarification } from "../tools";
import type { IntakeDraft, IntakeExtraction, ExistingPersonContext } from "../types";

// --- 测试辅助数据 ---

const emptyExistingPersons: ExistingPersonContext[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emptyExistingRelationships: any[] = [];

function makeBaseDraft(overrides?: Partial<IntakeDraft>): IntakeDraft {
  return {
    summary: "基础草稿",
    persons: [],
    relationships: [],
    ambiguities: [],
    questions: [],
    readyToApply: true,
    ...overrides,
  };
}

function makeEmptyExtraction(
  overrides?: Partial<IntakeExtraction>,
): IntakeExtraction {
  return {
    summary: "",
    persons: [],
    relationships: [],
    ambiguities: [],
    questions: [],
    ...overrides,
  };
}

describe("mergeDraftWithClarification", () => {
  // --- 场景1: 确认人物匹配 ---
  it("确认人物匹配：create 人物在补充后变为 reuse", () => {
    const existingPersons: ExistingPersonContext[] = [
      { id: "db-1", name: "王明", gender: "male", birthDate: null, deathDate: null },
    ];

    const previousDraft = makeBaseDraft({
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
          evidence: "口述中提到",
        },
      ],
      ambiguities: [
        {
          kind: "person_match",
          message: "\"王明\"可能需要匹配已有记录",
          relatedRefs: ["p1"],
          options: ["王明 (db-1)"],
          question: "请问\"王明\"是指家谱中已有的王明吗？",
        },
      ],
      readyToApply: false,
    });

    // LLM 补充后输出了相同 ref 的人物，且被 findPersonsByName 唯一匹配
    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p1",
          name: "王明",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "确认复用已有王明",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      existingPersons,
      emptyExistingRelationships,
    );

    assert.equal(merged.persons[0].action, "reuse");
    assert.equal(merged.persons[0].existingPersonId, "db-1");
    // person_match 歧义应被移除
    assert.equal(
      merged.ambiguities.some((a) => a.kind === "person_match"),
      false,
    );
  });

  // --- 场景2: 补充人物性别 ---
  it("补充人物性别：gender 从 unknown 更新为明确值，歧义移除", () => {
    const previousDraft = makeBaseDraft({
      persons: [
        {
          ref: "p1",
          action: "create",
          existingPersonId: null,
          name: "张三",
          gender: "unknown",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "口述中提到",
        },
      ],
      ambiguities: [
        {
          kind: "person_gender_unknown",
          message: "\"张三\"的性别还不明确",
          relatedRefs: ["p1"],
          options: ["male", "female"],
          question: "请问\"张三\"的性别是？",
        },
      ],
      readyToApply: false,
    });

    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p1",
          name: "张三",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "补充性别为男",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    assert.equal(merged.persons[0].gender, "male");
    assert.equal(
      merged.ambiguities.some((a) => a.kind === "person_gender_unknown"),
      false,
    );
  });

  // --- 场景3: 补充缺失关系引用 ---
  it("补充缺失关系引用：skip 关系在引用补全后恢复为 create", () => {
    const previousDraft = makeBaseDraft({
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
          evidence: "口述中提到",
        },
        {
          ref: "p2",
          action: "create",
          existingPersonId: null,
          name: "王建国",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "补充中提到",
        },
      ],
      relationships: [
        {
          ref: "r1",
          action: "skip",
          type: "child",
          personARef: "p2",
          personBRef: "p1",
          label: null,
          evidence: "",
          reason: "missing_reference",
        },
      ],
      ambiguities: [
        {
          kind: "missing_reference",
          message: "关系 r1 引用了不存在的人物引用。",
          relatedRefs: ["r1"],
          options: [],
        },
      ],
      readyToApply: false,
    });

    // 补充文本补齐了 p2 的引用
    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p2",
          name: "王建国",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "新增父亲",
        },
      ],
      relationships: [
        {
          ref: "r1",
          type: "child",
          personARef: "p2",
          personBRef: "p1",
          label: null,
          evidence: "确认父子关系",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    const restoredRel = merged.relationships.find((r) => r.ref === "r1");
    assert.equal(restoredRel?.action, "create");
    assert.equal(restoredRel?.reason, null);
    assert.equal(
      merged.ambiguities.some((a) => a.kind === "missing_reference"),
      false,
    );
  });

  // --- 场景4: 复用结果不被覆盖 ---
  it("已确认复用结果不被覆盖：reuse 人物保持 existingPersonId", () => {
    const previousDraft = makeBaseDraft({
      persons: [
        {
          ref: "p1",
          action: "reuse",
          existingPersonId: "db-existing-1",
          name: "王明",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "复用已有记录",
        },
      ],
      readyToApply: true,
    });

    // LLM 误输出该人物为 create（不应该发生，但防御性处理）
    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p1",
          name: "王明",
          gender: "female", // LLM 可能输出不同性别
          birthDate: "1990-01-01",
          deathDate: null,
          bio: "新增bio",
          evidence: "",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    // action 和 existingPersonId 必须保持不变
    assert.equal(merged.persons[0].action, "reuse");
    assert.equal(merged.persons[0].existingPersonId, "db-existing-1");
    // 性别不应被覆盖（原来不是 unknown）
    assert.equal(merged.persons[0].gender, "male");
    // 但 birthDate、bio 允许补全（原来为 null）
    assert.equal(merged.persons[0].birthDate, "1990-01-01");
    assert.equal(merged.persons[0].bio, "新增bio");
  });

  // --- 场景5: 新歧义追加 ---
  it("新歧义追加：增量提取中的新 ambiguities 被合并到结果中", () => {
    const previousDraft = makeBaseDraft({
      persons: [
        {
          ref: "p1",
          action: "create",
          existingPersonId: null,
          name: "李四",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
      ],
    });

    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p2",
          name: "王五",
          gender: "unknown",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
      ],
      ambiguities: ["新人物\"王五\"的代际关系不明确，需要进一步确认"],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    assert.equal(merged.persons.length, 2); // p1 保留 + p2 新增
    assert.equal(merged.ambiguities.length, 1);
    assert.ok(merged.ambiguities[0].message.includes("王五"));
  });

  // --- 场景6: 歧义移除 —— generation_unclear ---
  it("generation_unclear 歧义在关系恢复后被移除", () => {
    const previousDraft = makeBaseDraft({
      persons: [
        {
          ref: "p1",
          action: "create",
          existingPersonId: null,
          name: "张三",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
        {
          ref: "p2",
          action: "create",
          existingPersonId: null,
          name: "李四",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
      ],
      relationships: [
        {
          ref: "r1",
          action: "skip",
          type: "child",
          personARef: "p1",
          personBRef: "p2",
          label: null,
          evidence: "",
          reason: "missing_reference",
        },
      ],
      ambiguities: [
        {
          kind: "generation_unclear",
          message: "\"张三\"和\"李四\"之间是什么辈分关系？",
          relatedRefs: ["r1"],
          options: [],
          question: "请问谁是谁的父母/子女？",
        },
      ],
      readyToApply: false,
    });

    const incremental = makeEmptyExtraction({
      relationships: [
        {
          ref: "r1",
          type: "child",
          personARef: "p1",
          personBRef: "p2",
          label: "父子",
          evidence: "确认张三为李四的父亲",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    assert.equal(
      merged.ambiguities.some((a) => a.kind === "generation_unclear"),
      false,
    );
    const rel = merged.relationships.find((r) => r.ref === "r1");
    assert.equal(rel?.action, "create");
  });

  // --- 场景7: 未解决的歧义保留 ---
  it("未解决的歧义保留：与更新无关的歧义继续存在", () => {
    const previousDraft = makeBaseDraft({
      persons: [
        {
          ref: "p1",
          action: "create",
          existingPersonId: null,
          name: "张三",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
        {
          ref: "p2",
          action: "create",
          existingPersonId: null,
          name: "李四",
          gender: "unknown",
          birthDate: null,
          deathDate: null,
          bio: null,
          evidence: "",
        },
      ],
      ambiguities: [
        {
          kind: "person_gender_unknown",
          message: "\"李四\"的性别还不明确",
          relatedRefs: ["p2"],
          options: ["male", "female"],
          question: "请问\"李四\"的性别是？",
        },
      ],
      readyToApply: false,
    });

    // 增量只更新了 p1，p2 的性别歧义未解决
    const incremental = makeEmptyExtraction({
      persons: [
        {
          ref: "p1",
          name: "张三",
          gender: "male",
          birthDate: "1980-01-01",
          deathDate: null,
          bio: null,
          evidence: "补充生日",
        },
      ],
    });

    const merged = mergeDraftWithClarification(
      previousDraft,
      incremental,
      emptyExistingPersons,
      emptyExistingRelationships,
    );

    // p2 的性别歧义仍保留
    assert.equal(merged.ambiguities.length, 1);
    assert.equal(merged.ambiguities[0].kind, "person_gender_unknown");
    assert.equal(merged.readyToApply, false);
  });
});

console.log("✅ 所有 mergeDraftWithClarification 测试通过");

import test from "node:test";
import assert from "node:assert/strict";
import { completionReportSchema, describeMissingEvidence } from "./completion-contracts";

test("资料补全结论区分数据库缺失与来源未发现", () => {
  assert.match(describeMissingEvidence("出生日期", false), /字段缺失/);
  assert.match(describeMissingEvidence("出生日期", true), /未发现.*证据/);
  assert.doesNotMatch(describeMissingEvidence("出生日期", true), /不存在/);
});

test("资料补全报告限制人物范围和阻塞问题数量", () => {
  assert.equal(completionReportSchema.safeParse({
    kind: "report",
    target: { personIds: ["person"], label: "张三" },
    findings: [{ field: "birthDate", status: "NOT_FOUND", summary: "未发现证据", evidence: [] }],
    blockingQuestions: ["出生年份大约是什么时候？"],
    summary: "完成范围内调查",
  }).success, true);
  assert.equal(completionReportSchema.safeParse({
    kind: "report",
    target: { personIds: [], label: "无限范围" },
    findings: [], blockingQuestions: [], summary: "",
  }).success, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { presentAgentArtifact } from "./artifact-presentation";

test("普通 Agent 报告可转换为用户可见文本", () => {
  const presented = presentAgentArtifact({
    kind: "report",
    summary: "已完成子女调查。",
    findings: [{ field: "子女", summary: "找到两位子女。" }],
    blockingQuestions: ["是否继续核对出生日期？"],
  });
  assert.match(presented.text ?? "", /已完成子女调查/);
  assert.match(presented.text ?? "", /找到两位子女/);
  assert.match(presented.text ?? "", /是否继续核对/);
});

test("草稿包装产物可交给现有草稿卡片展示", () => {
  const draft = { summary: "补全一人", persons: [], relationships: [], ambiguities: [], readyToApply: true };
  const presented = presentAgentArtifact({ kind: "draft", draft });
  assert.equal(presented.draft, draft);
  assert.equal(presented.text, "补全一人");
});

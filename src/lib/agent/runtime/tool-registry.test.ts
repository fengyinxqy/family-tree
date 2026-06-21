import test from "node:test";
import assert from "node:assert/strict";
import { createGenealogyToolRegistry } from "./genealogy-tools";
import { AgentToolError, hashAgentToolArguments } from "./tool-registry";

test("工具参数哈希与对象键顺序无关", () => {
  assert.equal(
    hashAgentToolArguments("lookup", { a: 1, b: 2 }),
    hashAgentToolArguments("lookup", { b: 2, a: 1 }),
  );
});

test("注册表只暴露 READ 与 PROPOSE 家谱工具", () => {
  const tools = createGenealogyToolRegistry().list();
  assert.ok(tools.some((item) => item.sideEffect === "READ"));
  assert.ok(tools.some((item) => item.sideEffect === "PROPOSE"));
  for (const forbidden of ["publish", "approve", "withdraw", "delete", "membership"]) {
    assert.equal(tools.some((item) => item.name.includes(forbidden)), false);
  }
});

test("未注册的敏感工具会被拒绝", () => {
  assert.throws(
    () => createGenealogyToolRegistry().get("publish_revision"),
    (error) => error instanceof AgentToolError && error.code === "TOOL_NOT_REGISTERED",
  );
});

test("OCR 预留模式要求来源定位与模型信息", async () => {
  const { ocrEvidenceFragmentSchema } = await import("./genealogy-tools");
  assert.equal(ocrEvidenceFragmentSchema.safeParse({
    materialId: "material",
    mediaObjectId: "media",
    page: 1,
    region: null,
    text: "张三",
    confidence: 0.98,
    extractor: "future-ocr",
    modelVersion: "v1",
  }).success, true);
});

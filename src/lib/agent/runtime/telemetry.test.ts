import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAgentTelemetry } from "./telemetry";

test("Agent 遥测递归隐藏密钥、正文、文件和业务 payload", () => {
  assert.deepEqual(sanitizeAgentTelemetry({
    runId: "run",
    apiKey: "secret",
    nested: { token: "token", content: "private", durationMs: 12 },
    payload: { name: "张三" },
  }), {
    runId: "run",
    apiKey: "[redacted]",
    nested: { token: "[redacted]", content: "[redacted]", durationMs: 12 },
    payload: "[redacted]",
  });
});

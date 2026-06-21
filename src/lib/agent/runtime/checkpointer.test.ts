import test from "node:test";
import assert from "node:assert/strict";
import { agentThreadConfig } from "./checkpointer";

test("根图检查点使用每次运行唯一的 thread_id，不依赖 checkpoint_ns", () => {
  assert.deepEqual(agentThreadConfig("session-1", "run-1"), {
    configurable: { thread_id: "session-1:run-1" },
  });
});

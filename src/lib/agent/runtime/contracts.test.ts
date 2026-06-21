import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AGENT_BUDGET, agentRuntimeStateSchema, isAgentBudgetExhausted } from "./contracts";

test("Agent 状态模式拒绝未知版本", () => {
  const base = {
    stateVersion: 1,
    sessionId: "session",
    runId: "run",
    userId: "user",
    treeId: "tree",
    goal: "检查资料",
    familyRevision: 0,
    budget: DEFAULT_AGENT_BUDGET,
    usage: { modelTurns: 0, toolCalls: 0, retries: 0, inputTokens: 0, outputTokens: 0, startedAtMs: 1 },
  };
  assert.equal(agentRuntimeStateSchema.parse(base).stateVersion, 1);
  assert.equal(agentRuntimeStateSchema.safeParse({ ...base, stateVersion: 2 }).success, false);
});

test("任一硬预算耗尽都会停止运行", () => {
  assert.equal(isAgentBudgetExhausted(DEFAULT_AGENT_BUDGET, {
    modelTurns: DEFAULT_AGENT_BUDGET.maxModelTurns,
    toolCalls: 0,
    retries: 0,
    inputTokens: 0,
    outputTokens: 0,
    startedAtMs: Date.now(),
  }), true);
});

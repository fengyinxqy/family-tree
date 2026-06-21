import test from "node:test";
import assert from "node:assert/strict";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatResult } from "@langchain/core/outputs";
import { Command, MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { buildBoundedAgentGraph, type BoundedAgentState } from "./graph";
import { AgentToolRegistry, hashAgentToolArguments } from "./tool-registry";
import { DEFAULT_AGENT_BUDGET } from "./contracts";

class SequenceChatModel extends BaseChatModel {
  private index = 0;
  constructor(private readonly responses: Array<AIMessage | Error>) { super({}); }
  _llmType() { return "sequence-test"; }
  bindTools() { return this; }
  async _generate(): Promise<ChatResult> {
    const message = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;
    if (message instanceof Error) throw message;
    return { generations: [{ text: typeof message.content === "string" ? message.content : "", message }] };
  }
}

function baseState(overrides: Partial<BoundedAgentState> = {}): BoundedAgentState {
  return {
    messages: [new HumanMessage("检查张三资料")],
    stateVersion: 1,
    sessionId: "session",
    runId: "run",
    userId: "user",
    treeId: "tree",
    goal: "检查张三资料",
    familyRevision: 1,
    budget: DEFAULT_AGENT_BUDGET,
    usage: { modelTurns: 0, toolCalls: 0, retries: 0, inputTokens: 0, outputTokens: 0, startedAtMs: Date.now() },
    pendingToolCalls: [],
    toolResults: [],
    interruption: null,
    confirmedArgumentsHash: null,
    artifact: null,
    finalText: "",
    terminationReason: null,
    ...overrides,
  };
}

function registry(sideEffect: "READ" | "PROPOSE" = "READ") {
  return new AgentToolRegistry().register({
    name: "test_tool",
    description: "测试工具",
    version: "1",
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    permissionAction: "family.read.workspace",
    sideEffect,
    timeoutMs: 100,
    async execute() { return { ok: true }; },
  });
}

test("LangGraph 在一次运行中执行多个工具后形成结果", async () => {
  const model = new SequenceChatModel([
    new AIMessage({ content: "", tool_calls: [
      { id: "call-1", name: "test_tool", args: { value: "a" }, type: "tool_call" },
      { id: "call-2", name: "test_tool", args: { value: "b" }, type: "tool_call" },
    ] }),
    new AIMessage("调查完成"),
  ]);
  let calls = 0;
  const graph = buildBoundedAgentGraph({
    model,
    registry: registry(),
    checkpointer: new MemorySaver(),
    toolExecutor: async () => { calls += 1; return { ok: true }; },
  });
  const result = await graph.invoke(baseState(), { configurable: { thread_id: "multi-tool" } });
  assert.equal(calls, 2);
  assert.equal(result.usage.toolCalls, 2);
  assert.equal(result.finalText, "调查完成");
  assert.equal(result.terminationReason, "COMPLETED");
});

test("预算耗尽时不再调用模型", async () => {
  const model = new SequenceChatModel([new AIMessage("不应执行")]);
  const graph = buildBoundedAgentGraph({ model, registry: registry(), checkpointer: new MemorySaver() });
  const result = await graph.invoke(baseState({
    usage: { modelTurns: DEFAULT_AGENT_BUDGET.maxModelTurns, toolCalls: 0, retries: 0, inputTokens: 0, outputTokens: 0, startedAtMs: Date.now() },
  }), { configurable: { thread_id: "budget" } });
  assert.equal(result.terminationReason, "BUDGET_EXHAUSTED");
});

test("模型和工具短暂失败时在预算内重试", async () => {
  const model = new SequenceChatModel([
    new Error("temporary model failure"),
    new AIMessage({ content: "", tool_calls: [{ id: "call-retry", name: "test_tool", args: { value: "retry" }, type: "tool_call" }] }),
    new AIMessage("重试后完成"),
  ]);
  let attempts = 0;
  const graph = buildBoundedAgentGraph({
    model,
    registry: registry(),
    checkpointer: new MemorySaver(),
    toolExecutor: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary tool failure");
      return { ok: true };
    },
  });
  const result = await graph.invoke(baseState(), { configurable: { thread_id: "retry" } });
  assert.equal(attempts, 2);
  assert.equal(result.usage.retries, 2);
  assert.equal(result.finalText, "重试后完成");
});

test("PROPOSE 工具在确认前中断，恢复后只执行一次", async () => {
  const args = { value: "proposal" };
  const model = new SequenceChatModel([
    new AIMessage({ content: "", tool_calls: [{ id: "call-propose", name: "test_tool", args, type: "tool_call" }] }),
    new AIMessage("待审修订已创建"),
  ]);
  const checkpointer = new MemorySaver();
  let calls = 0;
  const graph = buildBoundedAgentGraph({
    model,
    registry: registry("PROPOSE"),
    checkpointer,
    toolExecutor: async () => { calls += 1; return { ok: true }; },
  });
  const config = { configurable: { thread_id: "proposal" } };
  await graph.invoke(baseState(), config);
  const paused = await graph.getState(config);
  assert.equal(calls, 0);
  assert.equal((paused.values as BoundedAgentState).interruption?.kind, "CONFIRMATION");

  const argumentsHash = hashAgentToolArguments("test_tool", args);
  const resumed = await graph.invoke(new Command({ resume: { runId: "run", confirmation: true, argumentsHash } }), config);
  assert.equal(calls, 1);
  assert.equal(resumed.finalText, "待审修订已创建");
});

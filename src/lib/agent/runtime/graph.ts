import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool as langChainTool } from "@langchain/core/tools";
import {
  Annotation,
  Command,
  END,
  interrupt,
  MemorySaver,
  START,
  StateGraph,
  messagesStateReducer,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { prisma } from "@/lib/prisma";
import {
  appendAgentMessage,
  finishAgentRun,
  markAgentRunStarted,
  pauseAgentRun,
  recordAgentStep,
} from "@/services/agent-runtime.service";
import { initializeAgentCheckpointer, agentThreadConfig } from "./checkpointer";
import {
  agentBudgetSchema,
  agentInterruptionSchema,
  agentResumeCommandSchema,
  agentUsageSchema,
  isAgentBudgetExhausted,
  type AgentBudget,
  type AgentInterruption,
  type AgentStreamEvent,
  type AgentUsage,
} from "./contracts";
import { createAgentChatModel } from "./model-factory";
import { createGenealogyToolRegistry } from "./genealogy-tools";
import {
  executeRegisteredAgentTool,
  hashAgentToolArguments,
  type AgentToolRegistry,
} from "./tool-registry";
import { AGENT_STATE_VERSION } from "./versions";
import { logAgentRuntimeEvent } from "./telemetry";

type PendingToolCall = { id: string; name: string; args: Record<string, unknown> };
type ToolResult = { name: string; result: unknown };

const RuntimeState = Annotation.Root({
  messages: Annotation<BaseMessage[], BaseMessage | BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  stateVersion: Annotation<number>(),
  sessionId: Annotation<string>(),
  runId: Annotation<string>(),
  userId: Annotation<string>(),
  treeId: Annotation<string>(),
  goal: Annotation<string>(),
  familyRevision: Annotation<number>(),
  budget: Annotation<AgentBudget>(),
  usage: Annotation<AgentUsage>(),
  pendingToolCalls: Annotation<PendingToolCall[]>(),
  toolResults: Annotation<ToolResult[]>(),
  interruption: Annotation<AgentInterruption | null>(),
  confirmedArgumentsHash: Annotation<string | null>(),
  artifact: Annotation<unknown | null>(),
  finalText: Annotation<string>(),
  terminationReason: Annotation<"COMPLETED" | "WAITING_FOR_USER" | "WAITING_FOR_CONFIRMATION" | "FAILED" | "CANCELLED" | "BUDGET_EXHAUSTED" | null>(),
});

export type BoundedAgentState = typeof RuntimeState.State;

const COMPLETION_SYSTEM_PROMPT = `你是受约束的家谱资料补全 Agent。
你的职责是在用户指定的人物或分支范围内调查资料缺口，并形成可追溯的报告或可审阅草稿。

规则：
1. 先用 lookup_person 确定人物；多个候选时停止并请求澄清，不能自行选择。
2. 区分“数据库字段缺失”“已查来源中未发现”“来源冲突”和“信息完整”，未发现不等于不存在。
3. 只调用提供的工具，不猜测 ID，不编造日期、关系或来源。
4. 可以连续调用多个 READ 工具；create_revision_group 是 PROPOSE 工具，必须等待系统取得用户确认。
5. 不得要求或尝试发布、批准、撤回、删除或管理成员。
6. 回答使用简体中文。结论要包含调查范围、发现、证据/来源、仍需确认的问题和建议下一步。
7. 用户仅要求查询时不要生成修订；只有用户明确补充事实时才使用 draft_family_data。`;

function contentToText(message: AIMessage) {
  if (typeof message.content === "string") return message.content;
  return message.content.map((item) => typeof item === "string" ? item : "text" in item ? String(item.text) : "").join("");
}

function makeModelTools(registry: AgentToolRegistry) {
  return registry.list().map((definition) => langChainTool(
    async () => "工具由受约束执行器调用",
    {
      name: definition.name,
      description: definition.description,
      schema: definition.inputSchema,
    },
  ));
}

export interface BuildBoundedAgentGraphOptions {
  model?: BaseChatModel;
  registry?: AgentToolRegistry;
  checkpointer?: BaseCheckpointSaver;
  toolExecutor?: typeof executeRegisteredAgentTool;
}

export function buildBoundedAgentGraph(options: BuildBoundedAgentGraphOptions = {}) {
  const registry = options.registry ?? createGenealogyToolRegistry();
  const toolExecutor = options.toolExecutor ?? executeRegisteredAgentTool;
  const model = options.model ?? createAgentChatModel();
  if (!model.bindTools) throw new Error("当前模型不支持工具调用");
  const boundModel = model.bindTools(makeModelTools(registry));

  const graph = new StateGraph(RuntimeState)
    .addNode("load_context", async (state) => ({
      messages: state.messages.length === 0 ? [new HumanMessage(state.goal)] : [],
      pendingToolCalls: state.pendingToolCalls ?? [],
      toolResults: state.toolResults ?? [],
      interruption: null,
      confirmedArgumentsHash: state.confirmedArgumentsHash ?? null,
      finalText: state.finalText ?? "",
      terminationReason: null,
    }))
    .addNode("model_decision", async (state) => {
      if (isAgentBudgetExhausted(state.budget, state.usage)) {
        return { terminationReason: "BUDGET_EXHAUSTED" as const };
      }
      let retries = state.usage.retries;
      let response: AIMessage;
      while (true) {
        try {
          response = await boundModel.invoke([
            new SystemMessage(COMPLETION_SYSTEM_PROMPT),
            ...state.messages,
          ]) as AIMessage;
          break;
        } catch (error) {
          if (retries >= state.budget.maxRetries) throw error;
          retries += 1;
        }
      }
      const usageMetadata = response.usage_metadata;
      const usage = {
        ...state.usage,
        retries,
        modelTurns: state.usage.modelTurns + 1,
        inputTokens: state.usage.inputTokens + (usageMetadata?.input_tokens ?? 0),
        outputTokens: state.usage.outputTokens + (usageMetadata?.output_tokens ?? 0),
      };
      const pendingToolCalls = (response.tool_calls ?? []).map((call) => ({
        id: call.id ?? `${state.runId}:${usage.modelTurns}`,
        name: call.name,
        args: call.args as Record<string, unknown>,
      }));
      return {
        messages: [response],
        usage,
        pendingToolCalls,
        finalText: pendingToolCalls.length === 0 ? contentToText(response) : state.finalText,
      };
    })
    .addNode("execute_tool", async (state) => {
      let usage = state.usage;
      const messages: ToolMessage[] = [];
      const toolResults = [...state.toolResults];
      for (const call of state.pendingToolCalls) {
        if (usage.toolCalls >= state.budget.maxToolCalls) {
          return { messages, toolResults, usage, pendingToolCalls: [], terminationReason: "BUDGET_EXHAUSTED" as const };
        }
        const definition = registry.get(call.name);
        const argumentsHash = hashAgentToolArguments(call.name, call.args);
        if (definition.sideEffect === "PROPOSE" && state.confirmedArgumentsHash !== argumentsHash) {
          const interruption = agentInterruptionSchema.parse({
            kind: "CONFIRMATION",
            reason: "即将创建不可变修订组",
            question: "是否确认把当前草稿创建为待审校修订？这不会直接发布正式数据。",
            pendingTool: { name: call.name, argumentsHash, summary: definition.description },
            familyRevision: state.familyRevision,
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          });
          return { messages, toolResults, usage, interruption, terminationReason: "WAITING_FOR_CONFIRMATION" as const };
        }
        let retries = usage.retries;
        let result: unknown;
        while (true) {
          try {
            result = await toolExecutor(registry, {
              userId: state.userId,
              treeId: state.treeId,
              runId: state.runId,
              confirmedArgumentsHash: state.confirmedArgumentsHash ?? undefined,
            }, call.name, call.args);
            break;
          } catch (error) {
            if (retries >= state.budget.maxRetries) throw error;
            retries += 1;
          }
        }
        usage = { ...usage, toolCalls: usage.toolCalls + 1, retries };
        toolResults.push({ name: call.name, result });
        messages.push(new ToolMessage({ tool_call_id: call.id, content: JSON.stringify(result) }));
        if (call.name === "lookup_person" && result && typeof result === "object") {
          const lookup = result as { requiresClarification?: boolean; matches?: Array<{ id: string; name: string; birthDate?: string | null }> };
          if (lookup.requiresClarification) {
            const interruption = agentInterruptionSchema.parse({
              kind: "CLARIFICATION",
              reason: lookup.matches?.length ? "人物匹配不唯一" : "没有找到目标人物",
              question: lookup.matches?.length ? "请选择你指的是哪一位人物。" : "没有找到该人物，请补充姓名、出生年份或与已知成员的关系。",
              options: (lookup.matches ?? []).map((person) => ({
                value: person.id,
                label: `${person.name}${person.birthDate ? `（${person.birthDate}）` : ""}`,
              })),
              familyRevision: state.familyRevision,
              expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            });
            return { messages, toolResults, usage, interruption, terminationReason: "WAITING_FOR_USER" as const };
          }
        }
        if (call.name === "draft_family_data" && result && typeof result === "object") {
          const draft = result as { ambiguities?: Array<{ message: string; question?: string; options?: string[] }> };
          const ambiguity = draft.ambiguities?.[0];
          if (ambiguity) {
            const interruption = agentInterruptionSchema.parse({
              kind: "CLARIFICATION",
              reason: "录入草稿仍有歧义",
              question: ambiguity.question || ambiguity.message,
              options: (ambiguity.options ?? []).map((option) => ({ value: option, label: option })),
              familyRevision: state.familyRevision,
              expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            });
            return { messages, toolResults, usage, interruption, terminationReason: "WAITING_FOR_USER" as const };
          }
        }
      }
      return { messages, toolResults, usage, pendingToolCalls: [], confirmedArgumentsHash: null };
    })
    .addNode("budget_check", async (state) => ({
      terminationReason: isAgentBudgetExhausted(state.budget, state.usage) ? "BUDGET_EXHAUSTED" as const : null,
    }))
    .addNode("human_intervention", async (state) => {
      if (!state.interruption) return {};
      const resume = agentResumeCommandSchema.parse(interrupt(state.interruption));
      if (state.interruption.kind === "CONFIRMATION") {
        if (!resume.confirmation) {
          return {
            interruption: null,
            pendingToolCalls: [],
            confirmedArgumentsHash: null,
            finalText: "用户取消了修订组创建。",
            terminationReason: "COMPLETED" as const,
          };
        }
        if (resume.argumentsHash !== state.interruption.pendingTool?.argumentsHash) {
          throw new Error("确认参数哈希与等待中的工具调用不匹配");
        }
        return {
          interruption: null,
          confirmedArgumentsHash: resume.argumentsHash ?? null,
          terminationReason: null,
        };
      }
      return {
        messages: [new HumanMessage(resume.answer ?? "")],
        interruption: null,
        pendingToolCalls: [],
        terminationReason: null,
      };
    })
    .addNode("form_artifact", async (state) => {
      const draftResult = [...state.toolResults].reverse().find((item) => item.name === "draft_family_data");
      const revisionResult = [...state.toolResults].reverse().find((item) => item.name === "create_revision_group");
      return {
        artifact: revisionResult?.result ?? draftResult?.result ?? (state.finalText ? { kind: "report", content: state.finalText } : null),
        terminationReason: state.terminationReason ?? "COMPLETED",
      };
    })
    .addEdge(START, "load_context")
    .addEdge("load_context", "model_decision")
    .addConditionalEdges("model_decision", (state) => {
      if (state.terminationReason === "BUDGET_EXHAUSTED") return "form_artifact";
      return state.pendingToolCalls.length > 0 ? "execute_tool" : "form_artifact";
    })
    .addConditionalEdges("execute_tool", (state) => {
      if (state.interruption) return "human_intervention";
      if (state.terminationReason === "BUDGET_EXHAUSTED") return "form_artifact";
      return "budget_check";
    })
    .addConditionalEdges("human_intervention", (state) => {
      if (state.terminationReason === "COMPLETED") return "form_artifact";
      return state.confirmedArgumentsHash ? "execute_tool" : "model_decision";
    })
    .addConditionalEdges("budget_check", (state) => state.terminationReason ? "form_artifact" : "model_decision")
    .addEdge("form_artifact", END);

  return graph.compile({ checkpointer: options.checkpointer ?? new MemorySaver() });
}

type EmitAgentEvent = (event: AgentStreamEvent) => void | Promise<void>;

async function persistGraphUpdates(runId: string, updates: Record<string, unknown>, sequence: number, emit: EmitAgentEvent) {
  const [node, output] = Object.entries(updates)[0] ?? ["unknown", {}];
  const startedAt = Date.now();
  await recordAgentStep({
    runId,
    sequence,
    node,
    status: "COMPLETED",
    outputSummary: { keys: output && typeof output === "object" ? Object.keys(output as object) : [] },
    durationMs: Date.now() - startedAt,
  });
  await emit({ type: "step", runId, node, status: "COMPLETED" });
  logAgentRuntimeEvent("step.completed", { runId, node, sequence });
}

export async function executeBoundedAgentRun(runId: string, emit: EmitAgentEvent = () => undefined) {
  const run = await prisma.agentRun.findUniqueOrThrow({
    where: { id: runId },
    include: { session: { include: { tree: { select: { dataRevision: true } } } } },
  });
  const checkpointer = await initializeAgentCheckpointer();
  const graph = buildBoundedAgentGraph({ checkpointer });
  const budget = agentBudgetSchema.parse(run.budget);
  const usage = agentUsageSchema.parse(run.usage);
  await markAgentRunStarted(runId);
  await appendAgentMessage({ sessionId: run.sessionId, authorId: run.initiatedBy, role: "USER", content: run.goal });

  const input: BoundedAgentState = {
    messages: [new HumanMessage(run.goal)],
    stateVersion: AGENT_STATE_VERSION,
    sessionId: run.sessionId,
    runId: run.id,
    userId: run.initiatedBy,
    treeId: run.session.treeId,
    goal: run.goal,
    familyRevision: run.session.tree.dataRevision,
    budget,
    usage,
    pendingToolCalls: [],
    toolResults: [],
    interruption: null,
    confirmedArgumentsHash: null,
    artifact: null,
    finalText: "",
    terminationReason: null,
  };
  const config = { ...agentThreadConfig(run.sessionId, run.id), recursionLimit: budget.maxModelTurns * 4 + 10 };
  let sequence = 0;
  for await (const update of await graph.stream(input, { ...config, streamMode: "updates" })) {
    if (update && typeof update === "object" && !("__interrupt__" in update)) {
      await persistGraphUpdates(runId, update as Record<string, unknown>, sequence++, emit);
    }
  }
  return finalizePersistedGraphState(graph, config, runId, run.sessionId, emit);
}

export async function resumeBoundedAgentRun(runId: string, rawCommand: unknown, emit: EmitAgentEvent = () => undefined) {
  const command = agentResumeCommandSchema.parse(rawCommand);
  const run = await prisma.agentRun.findUniqueOrThrow({ where: { id: runId }, include: { session: { include: { tree: true } } } });
  const interruption = agentInterruptionSchema.parse(run.interruption);
  if (new Date(interruption.expiresAt).getTime() <= Date.now()) throw new Error("Agent 介入请求已过期");
  if (interruption.familyRevision !== run.session.tree.dataRevision) throw new Error("家谱数据已变化，需要重新开始调查");
  if (interruption.pendingTool && command.argumentsHash !== interruption.pendingTool.argumentsHash) throw new Error("确认参数已变化");
  const checkpointer = await initializeAgentCheckpointer();
  const graph = buildBoundedAgentGraph({ checkpointer });
  const config = { ...agentThreadConfig(run.sessionId, run.id), recursionLimit: agentBudgetSchema.parse(run.budget).maxModelTurns * 4 + 10 };
  let sequence = await prisma.agentStep.count({ where: { runId } });
  await markAgentRunStarted(runId);
  for await (const update of await graph.stream(new Command({ resume: command }), { ...config, streamMode: "updates" })) {
    if (update && typeof update === "object" && !("__interrupt__" in update)) {
      await persistGraphUpdates(runId, update as Record<string, unknown>, sequence++, emit);
    }
  }
  return finalizePersistedGraphState(graph, config, runId, run.sessionId, emit);
}

async function finalizePersistedGraphState(
  graph: ReturnType<typeof buildBoundedAgentGraph>,
  config: ReturnType<typeof agentThreadConfig> & { recursionLimit: number },
  runId: string,
  sessionId: string,
  emit: EmitAgentEvent,
) {
  const snapshot = await graph.getState(config);
  const state = snapshot.values as BoundedAgentState;
  if (snapshot.next.length > 0 && state.interruption) {
    const status = state.interruption.kind === "CONFIRMATION" ? "WAITING_FOR_CONFIRMATION" : "WAITING_FOR_USER";
    await pauseAgentRun(runId, status, state.interruption, state.usage as never);
    await emit({ type: "interruption", runId, interruption: state.interruption });
    await emit({ type: "done", runId, reason: status });
    logAgentRuntimeEvent("run.paused", { runId, status, usage: state.usage });
    return { status, interruption: state.interruption };
  }
  const status = state.terminationReason === "BUDGET_EXHAUSTED" ? "BUDGET_EXHAUSTED" : "COMPLETED";
  if (state.finalText) {
    await appendAgentMessage({ sessionId, role: "ASSISTANT", content: state.finalText, metadata: { runId } });
    await emit({ type: "text_delta", runId, content: state.finalText });
  }
  if (state.artifact) await emit({ type: "artifact", runId, artifact: state.artifact });
  await finishAgentRun(runId, status, {
    reason: state.terminationReason ?? "COMPLETED",
    result: (state.artifact ?? { content: state.finalText }) as never,
    usage: state.usage as never,
  });
  await emit({ type: "done", runId, reason: status });
  logAgentRuntimeEvent("run.finished", { runId, status, usage: state.usage, reason: state.terminationReason });
  return { status, artifact: state.artifact, content: state.finalText };
}

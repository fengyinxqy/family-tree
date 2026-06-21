import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { FamilyAction } from "@/lib/family-access/actions";
import { prisma } from "@/lib/prisma";
import { authorizeFamilyAction } from "@/services/family-authorization.service";

export type AgentToolSideEffect = "READ" | "PROPOSE";

export interface AgentToolContext {
  userId: string;
  treeId: string;
  runId: string;
  stepId?: string;
  confirmedArgumentsHash?: string;
}

export interface RegisteredAgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  permissionAction: FamilyAction;
  sideEffect: AgentToolSideEffect;
  timeoutMs: number;
  execute: (context: AgentToolContext, input: TInput) => Promise<TOutput>;
}

export class AgentToolRegistry {
  private readonly tools = new Map<string, RegisteredAgentTool>();

  register<TInput, TOutput>(tool: RegisteredAgentTool<TInput, TOutput>) {
    if (this.tools.has(tool.name)) throw new Error(`Agent 工具重复注册：${tool.name}`);
    this.tools.set(tool.name, tool as RegisteredAgentTool);
    return this;
  }

  get(name: string) {
    const tool = this.tools.get(name);
    if (!tool) throw new AgentToolError("TOOL_NOT_REGISTERED", `未注册 Agent 工具：${name}`);
    return tool;
  }

  list() {
    return [...this.tools.values()];
  }
}

export class AgentToolError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AgentToolError";
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashAgentToolArguments(name: string, args: unknown) {
  return createHash("sha256").update(`${name}:${stableJson(args)}`, "utf8").digest("hex");
}

function assertNoScopeInjection(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const forbidden = ["treeId", "userId", "createdBy", "storageKey"];
  for (const key of forbidden) {
    if (key in input) throw new AgentToolError("SCOPE_INJECTION", `工具参数不得包含 ${key}`);
  }
}

function safeSummary(value: unknown): Prisma.InputJsonValue {
  const visit = (item: unknown, depth: number): unknown => {
    if (depth > 5) return "[depth-limited]";
    if (typeof item === "string") return item.length > 500 ? `${item.slice(0, 500)}…` : item;
    if (typeof item === "number" || typeof item === "boolean" || item === null) return item;
    if (Array.isArray(item)) return item.slice(0, 50).map((entry) => visit(entry, depth + 1));
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>)
        .filter(([key]) => !/key|token|password|storage/i.test(key))
        .map(([key, entry]) => [key, visit(entry, depth + 1)]));
    }
    return String(item);
  };
  return visit(value, 0) as Prisma.InputJsonValue;
}

export async function executeRegisteredAgentTool(
  registry: AgentToolRegistry,
  context: AgentToolContext,
  name: string,
  rawInput: unknown,
) {
  const tool = registry.get(name);
  assertNoScopeInjection(rawInput);
  const input = tool.inputSchema.parse(rawInput);
  const argumentsHash = hashAgentToolArguments(name, input);
  if (tool.sideEffect === "PROPOSE" && context.confirmedArgumentsHash !== argumentsHash) {
    throw new AgentToolError("CONFIRMATION_REQUIRED", "提案级工具必须绑定当前参数并经用户确认");
  }

  await authorizeFamilyAction(context.userId, context.treeId, tool.permissionAction);
  const idempotencyKey = `${context.runId}:${name}:${argumentsHash}`;
  const existing = await prisma.agentToolCall.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "COMPLETED") return existing.resultSummary;

  const audit = existing || await prisma.agentToolCall.create({
    data: {
      runId: context.runId,
      stepId: context.stepId,
      toolName: name,
      toolVersion: tool.version,
      sideEffect: tool.sideEffect,
      idempotencyKey,
      argumentsHash,
      argumentsSummary: safeSummary(input),
      permissionAction: tool.permissionAction,
      permissionResult: "ALLOWED",
    },
  });
  await prisma.agentToolCall.update({ where: { id: audit.id }, data: { status: "RUNNING" } });
  const startedAt = Date.now();

  try {
    const result = await Promise.race([
      tool.execute(context, input),
      new Promise<never>((_, reject) => setTimeout(() => reject(new AgentToolError("TOOL_TIMEOUT", `工具 ${name} 执行超时`)), tool.timeoutMs)),
    ]);
    const parsed = tool.outputSchema.parse(result);
    const summary = safeSummary(parsed);
    await prisma.agentToolCall.update({
      where: { id: audit.id },
      data: { status: "COMPLETED", resultSummary: summary, durationMs: Date.now() - startedAt, completedAt: new Date() },
    });
    return parsed;
  } catch (error) {
    const category = error instanceof AgentToolError ? error.code : "TOOL_FAILURE";
    await prisma.agentToolCall.update({
      where: { id: audit.id },
      data: {
        status: "FAILED",
        errorCategory: category,
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "工具执行失败",
        durationMs: Date.now() - startedAt,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

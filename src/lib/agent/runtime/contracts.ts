import { z } from "zod";
import { AGENT_STATE_VERSION } from "./versions";

export const agentBudgetSchema = z.object({
  maxModelTurns: z.number().int().positive().max(20).default(6),
  maxToolCalls: z.number().int().positive().max(40).default(12),
  maxDurationMs: z.number().int().positive().max(300_000).default(60_000),
  maxToolDurationMs: z.number().int().positive().max(120_000).default(20_000),
  maxRetries: z.number().int().min(0).max(5).default(2),
  maxContextTokens: z.number().int().positive().max(200_000).default(32_000),
});

export type AgentBudget = z.infer<typeof agentBudgetSchema>;

export const DEFAULT_AGENT_BUDGET: AgentBudget = agentBudgetSchema.parse({});

export const agentUsageSchema = z.object({
  modelTurns: z.number().int().nonnegative().default(0),
  toolCalls: z.number().int().nonnegative().default(0),
  retries: z.number().int().nonnegative().default(0),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  startedAtMs: z.number().int().nonnegative(),
});

export type AgentUsage = z.infer<typeof agentUsageSchema>;

export const agentTerminationReasonSchema = z.enum([
  "COMPLETED",
  "WAITING_FOR_USER",
  "WAITING_FOR_CONFIRMATION",
  "FAILED",
  "CANCELLED",
  "BUDGET_EXHAUSTED",
]);

export const agentInterruptionSchema = z.object({
  kind: z.enum(["CLARIFICATION", "CONFIRMATION"]),
  reason: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  pendingTool: z.object({
    name: z.string(),
    argumentsHash: z.string(),
    summary: z.string(),
  }).optional(),
  familyRevision: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
});

export type AgentInterruption = z.infer<typeof agentInterruptionSchema>;

export const agentResumeCommandSchema = z.object({
  runId: z.string().min(1),
  answer: z.string().trim().min(1).max(10_000).optional(),
  confirmation: z.boolean().optional(),
  argumentsHash: z.string().optional(),
}).refine((value) => value.answer !== undefined || value.confirmation !== undefined, {
  message: "必须提供澄清回答或确认结果",
});

export const agentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text_delta"), runId: z.string(), content: z.string() }),
  z.object({ type: z.literal("step"), runId: z.string(), node: z.string(), status: z.string() }),
  z.object({ type: z.literal("tool"), runId: z.string(), tool: z.string(), status: z.string() }),
  z.object({ type: z.literal("interruption"), runId: z.string(), interruption: agentInterruptionSchema }),
  z.object({ type: z.literal("artifact"), runId: z.string(), artifact: z.unknown() }),
  z.object({ type: z.literal("error"), runId: z.string(), category: z.string(), message: z.string() }),
  z.object({ type: z.literal("done"), runId: z.string(), reason: agentTerminationReasonSchema }),
]);

export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;

export const agentRuntimeStateSchema = z.object({
  stateVersion: z.literal(AGENT_STATE_VERSION),
  sessionId: z.string(),
  runId: z.string(),
  userId: z.string(),
  treeId: z.string(),
  goal: z.string(),
  familyRevision: z.number().int().nonnegative(),
  budget: agentBudgetSchema,
  usage: agentUsageSchema,
  nextAction: z.string().nullable().default(null),
  pendingToolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    args: z.record(z.string(), z.unknown()),
  })).default([]),
  toolResults: z.array(z.object({ name: z.string(), result: z.unknown() })).default([]),
  interruption: agentInterruptionSchema.nullable().default(null),
  artifact: z.unknown().nullable().default(null),
  finalText: z.string().default(""),
  terminationReason: agentTerminationReasonSchema.nullable().default(null),
});

export type AgentRuntimeState = z.infer<typeof agentRuntimeStateSchema>;

export function isAgentBudgetExhausted(budget: AgentBudget, usage: AgentUsage, now = Date.now()) {
  return usage.modelTurns >= budget.maxModelTurns
    || usage.toolCalls >= budget.maxToolCalls
    || usage.retries > budget.maxRetries
    || usage.inputTokens + usage.outputTokens >= budget.maxContextTokens
    || now - usage.startedAtMs >= budget.maxDurationMs;
}


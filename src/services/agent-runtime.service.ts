import { Prisma, type AgentRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { agentBudgetSchema, DEFAULT_AGENT_BUDGET, type AgentBudget } from "@/lib/agent/runtime/contracts";
import { getAgentModelDescriptor } from "@/lib/agent/runtime/model-factory";
import {
  AGENT_GRAPH_VERSION,
  AGENT_PROMPT_VERSION,
  AGENT_STATE_VERSION,
  AGENT_TOOL_SCHEMA_VERSION,
} from "@/lib/agent/runtime/versions";

const ACTIVE_RUN_STATUSES: AgentRunStatus[] = [
  "PENDING",
  "RUNNING",
  "WAITING_FOR_USER",
  "WAITING_FOR_CONFIRMATION",
];

export class AgentRuntimeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

async function getOwnedAuthorizedSession(userId: string, sessionId: string) {
  const session = await prisma.agentSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AgentRuntimeError("SESSION_NOT_FOUND", "Agent 会话不存在");
  await authorizeFamilyAction(userId, session.treeId, "family.read.published");
  if (session.createdBy !== userId) {
    throw new AgentRuntimeError("SESSION_FORBIDDEN", "不能访问其他成员的 Agent 会话");
  }
  return session;
}

export async function createAgentSession(userId: string, treeId: string, input: {
  agentType?: string;
  title?: string;
}) {
  await authorizeFamilyAction(userId, treeId, "family.read.published");
  return prisma.agentSession.create({
    data: {
      treeId,
      createdBy: userId,
      agentType: input.agentType || "genealogy-completion",
      title: (input.title || "资料补全会话").trim().slice(0, 120),
    },
  });
}

export async function listAgentSessions(userId: string, treeId: string) {
  await authorizeFamilyAction(userId, treeId, "family.read.published");
  return prisma.agentSession.findMany({
    where: { treeId, createdBy: userId },
    orderBy: { updatedAt: "desc" },
    include: { currentRun: true, _count: { select: { messages: true, runs: true } } },
  });
}

export async function getAgentSession(userId: string, sessionId: string) {
  await getOwnedAuthorizedSession(userId, sessionId);
  return prisma.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { sequence: "asc" } },
      runs: { orderBy: { createdAt: "desc" }, include: { steps: { orderBy: { sequence: "asc" } } } },
      currentRun: true,
    },
  });
}

export async function appendAgentMessage(input: {
  sessionId: string;
  authorId?: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.agentMessage.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return tx.agentMessage.create({
      data: {
        sessionId: input.sessionId,
        authorId: input.authorId,
        role: input.role,
        content: input.content,
        sequence: (latest?.sequence ?? -1) + 1,
        metadata: input.metadata ?? {},
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function startAgentRun(userId: string, sessionId: string, goal: string, budget?: Partial<AgentBudget>) {
  const session = await getOwnedAuthorizedSession(userId, sessionId);
  const normalizedGoal = goal.trim();
  if (!normalizedGoal) throw new AgentRuntimeError("GOAL_REQUIRED", "运行目标不能为空");
  const parsedBudget = agentBudgetSchema.parse({ ...DEFAULT_AGENT_BUDGET, ...budget });
  const model = getAgentModelDescriptor();

  return prisma.$transaction(async (tx) => {
    const active = await tx.agentRun.findFirst({
      where: { sessionId, status: { in: ACTIVE_RUN_STATUSES } },
    });
    if (active) throw new AgentRuntimeError("ACTIVE_RUN_EXISTS", "该会话已有活动运行");

    const tree = await tx.familyTree.findUniqueOrThrow({
      where: { id: session.treeId },
      select: { dataRevision: true },
    });
    const run = await tx.agentRun.create({
      data: {
        sessionId,
        initiatedBy: userId,
        goal: normalizedGoal,
        status: "PENDING",
        budget: parsedBudget as Prisma.InputJsonValue,
        usage: { modelTurns: 0, toolCalls: 0, retries: 0, inputTokens: 0, outputTokens: 0, startedAtMs: Date.now(), familyRevision: tree.dataRevision },
        provider: model.provider,
        model: model.model,
        promptVersion: AGENT_PROMPT_VERSION,
        graphVersion: AGENT_GRAPH_VERSION,
        toolSchemaVersion: AGENT_TOOL_SCHEMA_VERSION,
        stateVersion: AGENT_STATE_VERSION,
      },
    });
    await tx.agentSession.update({ where: { id: sessionId }, data: { currentRunId: run.id } });
    return run;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markAgentRunStarted(runId: string) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function recordAgentStep(input: {
  runId: string;
  sequence: number;
  node: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  inputSummary?: Prisma.InputJsonValue;
  outputSummary?: Prisma.InputJsonValue;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCategory?: string;
}) {
  return prisma.agentStep.upsert({
    where: { runId_sequence: { runId: input.runId, sequence: input.sequence } },
    create: {
      ...input,
      inputSummary: input.inputSummary ?? {},
      outputSummary: input.outputSummary ?? {},
      completedAt: input.status === "RUNNING" ? null : new Date(),
    },
    update: {
      node: input.node,
      status: input.status,
      outputSummary: input.outputSummary ?? {},
      durationMs: input.durationMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      errorCategory: input.errorCategory,
      completedAt: input.status === "RUNNING" ? null : new Date(),
    },
  });
}

export async function pauseAgentRun(runId: string, status: "WAITING_FOR_USER" | "WAITING_FOR_CONFIRMATION", interruption: Prisma.InputJsonValue, usage?: Prisma.InputJsonValue) {
  return prisma.agentRun.update({ where: { id: runId }, data: { status, interruption, usage } });
}

export async function finishAgentRun(runId: string, status: "COMPLETED" | "FAILED" | "CANCELLED" | "BUDGET_EXHAUSTED", input: {
  reason: string;
  result?: Prisma.InputJsonValue;
  usage?: Prisma.InputJsonValue;
  errorCategory?: string;
  errorMessage?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.agentRun.update({
      where: { id: runId },
      data: {
        status,
        terminationReason: input.reason,
        result: input.result,
        usage: input.usage,
        errorCategory: input.errorCategory,
        errorMessage: input.errorMessage?.slice(0, 1000),
        interruption: Prisma.JsonNull,
        endedAt: new Date(),
      },
    });
    await tx.agentSession.updateMany({
      where: { id: run.sessionId, currentRunId: runId },
      data: { currentRunId: null },
    });
    return run;
  });
}

export async function cancelAgentRun(userId: string, runId: string) {
  const run = await prisma.agentRun.findUnique({ include: { session: true }, where: { id: runId } });
  if (!run) throw new AgentRuntimeError("RUN_NOT_FOUND", "Agent 运行不存在");
  await getOwnedAuthorizedSession(userId, run.sessionId);
  if (!ACTIVE_RUN_STATUSES.includes(run.status)) {
    throw new AgentRuntimeError("RUN_NOT_ACTIVE", "只能取消活动或等待中的运行");
  }
  return finishAgentRun(runId, "CANCELLED", { reason: "USER_CANCELLED", usage: run.usage as Prisma.InputJsonValue });
}

export async function getResumableAgentRun(userId: string, runId: string) {
  const run = await prisma.agentRun.findUnique({ include: { session: true }, where: { id: runId } });
  if (!run) throw new AgentRuntimeError("RUN_NOT_FOUND", "Agent 运行不存在");
  await getOwnedAuthorizedSession(userId, run.sessionId);
  if (run.stateVersion !== AGENT_STATE_VERSION || run.graphVersion !== AGENT_GRAPH_VERSION) {
    throw new AgentRuntimeError("INCOMPATIBLE_CHECKPOINT", "该运行由不兼容的 Agent 版本创建，请新建运行");
  }
  return run;
}

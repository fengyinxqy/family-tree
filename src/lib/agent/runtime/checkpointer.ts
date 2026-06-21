import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const globalForCheckpointer = globalThis as unknown as {
  agentCheckpointer?: PostgresSaver;
  agentCheckpointerSetup?: Promise<void>;
};

function createCheckpointer() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("缺少 DATABASE_URL，无法初始化 Agent 检查点");
  return PostgresSaver.fromConnString(connectionString, { schema: "public" });
}

export function getAgentCheckpointer() {
  if (!globalForCheckpointer.agentCheckpointer) {
    globalForCheckpointer.agentCheckpointer = createCheckpointer();
  }
  return globalForCheckpointer.agentCheckpointer;
}

export async function initializeAgentCheckpointer() {
  if (!globalForCheckpointer.agentCheckpointerSetup) {
    globalForCheckpointer.agentCheckpointerSetup = getAgentCheckpointer().setup();
  }
  await globalForCheckpointer.agentCheckpointerSetup;
  return getAgentCheckpointer();
}

export function agentThreadConfig(sessionId: string, runId: string) {
  // LangGraph 根图始终将检查点写入空 checkpoint_ns；该字段主要供子图使用。
  // 因此用 session + run 组成 thread_id 来隔离每次运行，确保完成阶段能读回
  // 本次运行的最终状态，同时避免同一会话中的多次运行互相覆盖。
  return { configurable: { thread_id: `${sessionId}:${runId}` } };
}

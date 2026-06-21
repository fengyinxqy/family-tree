import type { AgentStreamEvent } from "./contracts";
import { finishAgentRun } from "@/services/agent-runtime.service";
import { logAgentRuntimeEvent } from "./telemetry";

export function createAgentEventStream(
  runId: string,
  execute: (emit: (event: AgentStreamEvent) => void) => Promise<unknown>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: AgentStreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await execute(send);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent 运行失败";
        logAgentRuntimeEvent("run.failed", { runId, errorCategory: "RUNTIME_FAILURE", errorMessage: message });
        send({ type: "error", runId, category: "RUNTIME_FAILURE", message });
        try {
          await finishAgentRun(runId, "FAILED", {
            reason: "RUNTIME_FAILURE",
            errorCategory: "RUNTIME_FAILURE",
            errorMessage: message,
          });
        } catch {
          // 原始错误优先；数据库错误由服务端日志捕获。
        }
        send({ type: "done", runId, reason: "FAILED" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

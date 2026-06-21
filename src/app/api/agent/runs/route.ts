import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAgentEventStream } from "@/lib/agent/runtime/http";
import { executeBoundedAgentRun } from "@/lib/agent/runtime/graph";
import { startAgentRun } from "@/services/agent-runtime.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startRunSchema = z.object({
  sessionId: z.string().min(1),
  goal: z.string().trim().min(1).max(50_000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const input = startRunSchema.parse(await request.json());
    const run = await startAgentRun(session.user.id, input.sessionId, input.goal);
    return createAgentEventStream(run.id, (emit) => executeBoundedAgentRun(run.id, emit));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "启动 Agent 运行失败" }, { status: 400 });
  }
}


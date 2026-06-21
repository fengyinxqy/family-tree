import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { agentResumeCommandSchema } from "@/lib/agent/runtime/contracts";
import { createAgentEventStream } from "@/lib/agent/runtime/http";
import { resumeBoundedAgentRun } from "@/lib/agent/runtime/graph";
import { getResumableAgentRun } from "@/services/agent-runtime.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const { id } = await params;
    await getResumableAgentRun(session.user.id, id);
    const command = agentResumeCommandSchema.parse({ ...(await request.json()), runId: id });
    return createAgentEventStream(id, (emit) => resumeBoundedAgentRun(id, command, emit));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "恢复 Agent 运行失败" }, { status: 400 });
  }
}


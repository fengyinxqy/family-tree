import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgentSession } from "@/services/agent-runtime.service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ session: await getAgentSession(session.user.id, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取 Agent 会话失败" }, { status: 404 });
  }
}


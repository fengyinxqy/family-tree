import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cancelAgentRun } from "@/services/agent-runtime.service";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ run: await cancelAgentRun(session.user.id, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "取消 Agent 运行失败" }, { status: 400 });
  }
}

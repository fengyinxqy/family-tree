import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { createAgentSession, listAgentSessions } from "@/services/agent-runtime.service";

export const runtime = "nodejs";

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  agentType: z.literal("genealogy-completion").optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
    return NextResponse.json({ sessions: await listAgentSessions(session.user.id, tree.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取 Agent 会话失败" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const input = createSessionSchema.parse(await request.json());
    const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
    const created = await createAgentSession(session.user.id, tree.id, input);
    return NextResponse.json({ session: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建 Agent 会话失败" }, { status: 400 });
  }
}


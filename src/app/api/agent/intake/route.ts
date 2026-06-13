import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runIntakeAgent } from "@/lib/agent/intake-agent";
import { intakeRouteRequestSchema } from "@/lib/agent/schemas";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = intakeRouteRequestSchema.parse(await request.json());
    const draft = await runIntakeAgent(session.user.id, body.text);
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intake agent failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

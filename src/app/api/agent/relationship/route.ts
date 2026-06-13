import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { relationshipRouteRequestSchema } from "@/lib/agent/schemas";
import { runRelationshipAgent } from "@/lib/agent/relationship-agent";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = relationshipRouteRequestSchema.parse(await request.json());
    const result = await runRelationshipAgent(session.user.id, body.question);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relationship agent failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

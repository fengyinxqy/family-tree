import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { buildIntakeRevisionGroup, getStandaloneRelationshipRevision } from "@/lib/agent/intake-revision-group";
import { intakeApplyRequestSchema } from "@/lib/agent/schemas";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { createAiRelationshipRevision, createRevisionGroup } from "@/services/revision-group.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = intakeApplyRequestSchema.parse(await request.json());

    if (!body.draft.readyToApply) {
      return NextResponse.json(
        { error: "当前草稿仍有歧义，不能直接落库。" },
        { status: 409 },
      );
    }

    const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
    const input = buildIntakeRevisionGroup(body.draft, {
      sourceText: body.sourceText,
      conversationRounds: body.conversationRounds,
    });
    const standaloneRelationship = getStandaloneRelationshipRevision(input);
    if (standaloneRelationship) {
      const revision = await createAiRelationshipRevision(session.user.id, activeTree.id, standaloneRelationship, input.source);
      revalidatePath("/reviews");
      return NextResponse.json({ kind: "revision", revisionId: revision.id, status: revision.status }, { status: 201 });
    }
    const group = await createRevisionGroup(session.user.id, activeTree.id, input);
    revalidatePath("/reviews");
    return NextResponse.json({ kind: "group", groupId: group.id, status: group.status, memberCount: group.memberCount }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apply intake draft failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

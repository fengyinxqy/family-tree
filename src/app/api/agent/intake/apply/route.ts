import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { applyIntakeDraft } from "@/lib/agent/tools";
import { intakeApplyRequestSchema } from "@/lib/agent/schemas";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

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
    const result = await applyIntakeDraft(session.user.id, activeTree.id, body.draft);
    revalidatePath("/tree");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apply intake draft failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

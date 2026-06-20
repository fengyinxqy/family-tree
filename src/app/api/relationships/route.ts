import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRelationship } from "@/services/relationship.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { type, personAId, personBId, sortOrder, label } = body;

  try {
    const relationship = await createRelationship({
      type,
      personAId,
      personBId,
      sortOrder,
      label,
    });

    return NextResponse.json(relationship, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加关系失败";
    const status =
      message === "无权操作" ? 403 : message.includes("已存在") ? 409 : message === "未登录" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE handler: uses the new preview-confirm flow
export async function DELETE() {
  return Response.json({
    error: "请使用预览-确认流程删除关系（previewRelationshipDeletion + deleteRelationship）",
    deprecated: true
  }, { status: 410 });
}
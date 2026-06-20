import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPerson, updatePerson } from "@/services/person.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  try {
    const person = await getPerson(id);
    return NextResponse.json(person);
  } catch {
    return NextResponse.json({ error: "不存在" }, { status: 404 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.birthDate !== undefined) data.birthDate = body.birthDate ?? null;
    if (body.deathDate !== undefined) data.deathDate = body.deathDate ?? null;
    if (body.bio !== undefined) data.bio = body.bio ?? null;
    if (body.aliases !== undefined) data.aliases = body.aliases;
    if (body.generationNumber !== undefined) data.generationNumber = body.generationNumber;
    if (body.generationLabel !== undefined) data.generationLabel = body.generationLabel ?? null;
    if (body.nativePlace !== undefined) data.nativePlace = body.nativePlace ?? null;
    if (body.notes !== undefined) data.notes = body.notes ?? null;
    if (body.events !== undefined) data.events = body.events;

    const updated = await updatePerson(id, data);

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    const status = message === "无权操作" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE handler: uses the new preview-confirm flow
export async function DELETE() {
  return Response.json({
    error: "请使用预览-确认流程删除人物（previewPersonDeletion + deletePerson）",
    deprecated: true
  }, { status: 410 });
}

// PATCH for position updates
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const person = await prisma.person.findUnique({ where: { id, deletedAt: null } });
  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  const { x, y } = await request.json();
  await prisma.person.update({
    where: { id },
    data: { posX: x, posY: y },
  });

  return NextResponse.json({ success: true });
}
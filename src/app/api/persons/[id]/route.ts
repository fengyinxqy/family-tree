import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPerson } from "@/services/person.service";
import { createContentDraft } from "@/services/editorial-revision.service";

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

    const current = await getPerson(id);
    const updated = await createContentDraft({
      contentType: "PERSON",
      targetEntityId: id,
      payload: {
        name: body.name ?? current.name,
        gender: body.gender ?? current.gender,
        birthDate: body.birthDate !== undefined ? body.birthDate : current.birthDate,
        deathDate: body.deathDate !== undefined ? body.deathDate : current.deathDate,
        bio: body.bio !== undefined ? body.bio : current.bio,
        aliases: body.aliases ?? current.aliases,
        generationNumber: body.generationNumber ?? current.generationNumber,
        generationLabel: body.generationLabel !== undefined ? body.generationLabel : current.generationLabel,
        nativePlace: body.nativePlace !== undefined ? body.nativePlace : current.nativePlace,
        notes: body.notes !== undefined ? body.notes : current.notes,
        posX: current.posX,
        posY: current.posY,
        events: body.events ?? current.events,
      },
    });

    return NextResponse.json(updated, { status: 202 });
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
  try {
    const person = await getPerson(id);
    const { x, y } = await request.json();
    const revision = await createContentDraft({
      contentType: "PERSON",
      targetEntityId: id,
      payload: {
        name: person.name,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        bio: person.bio,
        aliases: person.aliases,
        generationNumber: person.generationNumber,
        generationLabel: person.generationLabel,
        nativePlace: person.nativePlace,
        notes: person.notes,
        posX: x,
        posY: y,
        events: person.events,
      },
    });
    return NextResponse.json(revision, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "位置修订创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

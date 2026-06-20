import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createContentDraft } from "@/services/editorial-revision.service";
import { getPerson } from "@/services/person.service";

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

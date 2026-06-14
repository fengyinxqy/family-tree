import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPerson } from "@/services/person.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  const persons = await prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(persons);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await request.json();

    const person = await createPerson({
      name: body.name,
      gender: body.gender,
      birthDate: body.birthDate ?? null,
      deathDate: body.deathDate ?? null,
      bio: body.bio ?? null,
      aliases: body.aliases ?? [],
      generationNumber: body.generationNumber ?? 1,
      generationLabel: body.generationLabel ?? null,
      nativePlace: body.nativePlace ?? null,
      notes: body.notes ?? null,
      events: body.events ?? [],
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

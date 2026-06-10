import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const persons = await prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(persons);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json();
  const person = await prisma.person.create({
    data: { ...body, createdBy: session.user.id },
  });

  return NextResponse.json(person, { status: 201 });
}

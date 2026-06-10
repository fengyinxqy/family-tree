import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "不存在" }, { status: 404 });
  }

  return NextResponse.json(person);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.person.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });
  await prisma.person.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

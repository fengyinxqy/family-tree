import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json();
  const { type, personAId, personBId, sortOrder, label } = body;

  // 验证权限
  const [a, b] = await Promise.all([
    prisma.person.findUnique({ where: { id: personAId } }),
    prisma.person.findUnique({ where: { id: personBId } }),
  ]);

  if (!a || !b || a.createdBy !== session.user.id || b.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  if (type === "spouse") {
    const existing = await prisma.relationship.findFirst({
      where: {
        type: "spouse",
        OR: [
          { personAId, personBId },
          { personAId: personBId, personBId: personAId },
        ],
      },
    });
    if (existing) return NextResponse.json({ error: "该配偶关系已存在" }, { status: 409 });
  }

  const rel = await prisma.relationship.create({
    data: { type, personAId, personBId, label: label || null, sortOrder: sortOrder || 0 },
  });

  return NextResponse.json(rel, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await request.json();
  await prisma.relationship.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

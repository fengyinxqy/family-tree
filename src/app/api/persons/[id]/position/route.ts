import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
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

"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createRelationship(data: {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  sortOrder?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  // 验证两个人物都属于该用户
  const [a, b] = await Promise.all([
    prisma.person.findUnique({ where: { id: data.personAId } }),
    prisma.person.findUnique({ where: { id: data.personBId } }),
  ]);

  if (!a || !b || a.createdBy !== session.user.id || b.createdBy !== session.user.id) {
    throw new Error("无权操作");
  }

  // 配偶关系：检查是否已存在
  if (data.type === "spouse") {
    const existing = await prisma.relationship.findFirst({
      where: {
        type: "spouse",
        OR: [
          { personAId: data.personAId, personBId: data.personBId },
          { personAId: data.personBId, personBId: data.personAId },
        ],
      },
    });
    if (existing) throw new Error("该配偶关系已存在");
  }

  const rel = await prisma.relationship.create({ data });
  revalidatePath("/tree");
  return rel;
}

export async function deleteRelationship(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  await prisma.relationship.delete({ where: { id } });
  revalidatePath("/tree");
}

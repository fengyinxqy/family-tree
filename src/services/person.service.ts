"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPersons() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  return prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    throw new Error("人物不存在");
  }

  return person;
}

export async function createPerson(data: {
  name: string;
  gender: string;
  birthDate?: string;
  deathDate?: string;
  bio?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.create({
    data: { ...data, createdBy: session.user.id },
  });

  revalidatePath("/tree");
  return person;
}

export async function updatePerson(
  id: string,
  data: { name?: string; gender?: string; birthDate?: string; deathDate?: string; bio?: string }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) throw new Error("无权操作");

  const updated = await prisma.person.update({ where: { id }, data });
  revalidatePath("/tree");
  return updated;
}

export async function deletePerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) throw new Error("无权操作");

  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });

  await prisma.person.delete({ where: { id } });
  revalidatePath("/tree");
}

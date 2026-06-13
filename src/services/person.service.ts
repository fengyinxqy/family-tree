"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { PersonEventData } from "@/types";

// ── 输入类型 ──────────────────────────────────────────────

export interface PersonEventInput {
  type: "birth" | "marriage" | "migration" | "other";
  title?: string | null;
  dateLabel?: string | null;
  location?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface CreatePersonInput {
  name: string;
  gender: string;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  aliases?: string[];
  generationLabel?: string | null;
  nativePlace?: string | null;
  notes?: string | null;
  events?: PersonEventInput[];
}

export interface UpdatePersonInput {
  name?: string;
  gender?: string;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  aliases?: string[];
  generationLabel?: string | null;
  nativePlace?: string | null;
  notes?: string | null;
  events?: PersonEventInput[];
}

export interface PersonDetailResult {
  id: string;
  name: string;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  aliases: string[];
  generationLabel: string | null;
  nativePlace: string | null;
  notes: string | null;
  posX: number | null;
  posY: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  events: PersonEventData[];
  relationsA: Array<{
    id: string;
    type: string;
    label: string | null;
    sortOrder: number;
    personB: {
      id: string;
      name: string;
      gender: string;
      birthDate: string | null;
      deathDate: string | null;
    };
  }>;
  relationsB: Array<{
    id: string;
    type: string;
    label: string | null;
    sortOrder: number;
    personA: {
      id: string;
      name: string;
      gender: string;
      birthDate: string | null;
      deathDate: string | null;
    };
  }>;
}

// ── 校验 ──────────────────────────────────────────────────

/** 合法的日期标签格式: YYYY / YYYY-MM / YYYY-MM-DD / 空 */
const DATE_LABEL_RE = /^(\d{4}(-\d{2}(-\d{2})?)?)?$/;

function validateEvents(events: PersonEventInput[]): void {
  // 检查是否有重复的事件类型（birth 只能有一条）
  const birthCount = events.filter((e) => e.type === "birth").length;
  if (birthCount > 1) throw new Error("出生事件只能有一个");

  for (const event of events) {
    if (event.dateLabel && !DATE_LABEL_RE.test(event.dateLabel)) {
      throw new Error(`事件日期格式无效: "${event.dateLabel}"，请使用 YYYY、YYYY-MM 或 YYYY-MM-DD`);
    }
  }
}

// ── 查询 ──────────────────────────────────────────────────

export async function getPersons() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  return prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPerson(id: string): Promise<PersonDetailResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      events: { orderBy: { sortOrder: "asc" } },
      relationsA: {
        include: {
          personB: {
            select: { id: true, name: true, gender: true, birthDate: true, deathDate: true },
          },
        },
      },
      relationsB: {
        include: {
          personA: {
            select: { id: true, name: true, gender: true, birthDate: true, deathDate: true },
          },
        },
      },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    throw new Error("人物不存在");
  }

  return person as unknown as PersonDetailResult;
}

// ── 创建 ──────────────────────────────────────────────────

export async function createPerson(input: CreatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const userId = session.user.id;

  if (input.events) validateEvents(input.events);

  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate ?? null,
        deathDate: input.deathDate ?? null,
        bio: input.bio ?? null,
        aliases: input.aliases ?? [],
        generationLabel: input.generationLabel ?? null,
        nativePlace: input.nativePlace ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    if (input.events && input.events.length > 0) {
      await tx.personEvent.createMany({
        data: input.events.map((e, i) => ({
          personId: created.id,
          type: e.type,
          title: e.title ?? null,
          dateLabel: e.dateLabel ?? null,
          location: e.location ?? null,
          description: e.description ?? null,
          sortOrder: e.sortOrder ?? i,
        })),
      });
    }

    return created;
  });

  revalidatePath("/tree");
  return person;
}

// ── 更新 ──────────────────────────────────────────────────

export async function updatePerson(id: string, input: UpdatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing || existing.createdBy !== session.user.id) throw new Error("无权操作");

  if (input.events) validateEvents(input.events);

  const updated = await prisma.$transaction(async (tx) => {
    // 更新人物基础字段
    const person = await tx.person.update({
      where: { id },
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate,
        deathDate: input.deathDate,
        bio: input.bio,
        aliases: input.aliases,
        generationLabel: input.generationLabel,
        nativePlace: input.nativePlace,
        notes: input.notes,
      },
    });

    // 如果传入了 events，采用替换式写入：删旧建新
    if (input.events !== undefined) {
      await tx.personEvent.deleteMany({ where: { personId: id } });
      if (input.events.length > 0) {
        await tx.personEvent.createMany({
          data: input.events.map((e, i) => ({
            personId: id,
            type: e.type,
            title: e.title ?? null,
            dateLabel: e.dateLabel ?? null,
            location: e.location ?? null,
            description: e.description ?? null,
            sortOrder: e.sortOrder ?? i,
          })),
        });
      }
    }

    return person;
  });

  revalidatePath("/tree");
  return updated;
}

// ── 删除 ──────────────────────────────────────────────────

export async function deletePerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) throw new Error("无权操作");

  // 先删关联事件
  await prisma.personEvent.deleteMany({ where: { personId: id } });
  // 删关系
  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });
  // 删人物
  await prisma.person.delete({ where: { id } });

  revalidatePath("/tree");
}

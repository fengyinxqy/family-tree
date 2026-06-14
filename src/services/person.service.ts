"use server";

import { auth } from "@/lib/auth";
import { deriveSiblingRelations, type DerivedSiblingRelation } from "@/lib/relationships/derived-siblings";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PersonEventData } from "@/types";

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
  generationNumber?: number;
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
  generationNumber?: number;
  generationLabel?: string | null;
  nativePlace?: string | null;
  notes?: string | null;
  events?: PersonEventInput[];
}

export type PersonSiblingData = DerivedSiblingRelation;

export interface PersonDetailResult {
  id: string;
  name: string;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  aliases: string[];
  generationNumber: number;
  generationLabel: string | null;
  nativePlace: string | null;
  notes: string | null;
  posX: number | null;
  posY: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  events: PersonEventData[];
  siblings: PersonSiblingData[];
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

const DATE_LABEL_RE = /^(\d{4}(-\d{2}(-\d{2})?)?)?$/;

function validateEvents(events: PersonEventInput[]): void {
  const birthCount = events.filter((event) => event.type === "birth").length;
  if (birthCount > 1) {
    throw new Error("出生事件只能有一个");
  }

  for (const event of events) {
    if (event.dateLabel && !DATE_LABEL_RE.test(event.dateLabel)) {
      throw new Error(`事件日期格式无效: "${event.dateLabel}"，请使用 YYYY、YYYY-MM 或 YYYY-MM-DD`);
    }
  }
}

export async function getPersons() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  return prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

async function getDerivedSiblings(
  personId: string,
  personGender: string,
  relationsB: PersonDetailResult["relationsB"],
) {
  const parentIds = [...new Set(relationsB.filter((relation) => relation.type === "child").map((relation) => relation.personA.id))];

  if (parentIds.length === 0) {
    return [];
  }

  const siblingRelations = await prisma.relationship.findMany({
    where: {
      type: "child",
      personAId: { in: parentIds },
      NOT: { personBId: personId },
    },
    include: {
      personA: {
        select: {
          id: true,
          name: true,
        },
      },
      personB: {
        select: {
          id: true,
          name: true,
          gender: true,
        },
      },
    },
    orderBy: [{ personAId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return deriveSiblingRelations(
    personId,
    personGender,
    siblingRelations.map((relation) => ({
      parentId: relation.personA.id,
      parentName: relation.personA.name,
      sibling: {
        id: relation.personB.id,
        name: relation.personB.name,
        gender: relation.personB.gender,
      },
    })),
  );
}

export async function getPerson(id: string): Promise<PersonDetailResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

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

  const siblings = await getDerivedSiblings(id, person.gender, person.relationsB as PersonDetailResult["relationsB"]);

  return {
    ...(person as unknown as Omit<PersonDetailResult, "siblings">),
    siblings,
  };
}

export async function createPerson(input: CreatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const userId = session.user.id;

  if (input.events) {
    validateEvents(input.events);
  }

  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate ?? null,
        deathDate: input.deathDate ?? null,
        bio: input.bio ?? null,
        aliases: input.aliases ?? [],
        generationNumber: input.generationNumber ?? 1,
        generationLabel: input.generationLabel ?? null,
        nativePlace: input.nativePlace ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    if (input.events && input.events.length > 0) {
      await tx.personEvent.createMany({
        data: input.events.map((event, index) => ({
          personId: created.id,
          type: event.type,
          title: event.title ?? null,
          dateLabel: event.dateLabel ?? null,
          location: event.location ?? null,
          description: event.description ?? null,
          sortOrder: event.sortOrder ?? index,
        })),
      });
    }

    return created;
  });

  revalidatePath("/tree");
  return person;
}

export async function updatePerson(id: string, input: UpdatePersonInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing || existing.createdBy !== session.user.id) {
    throw new Error("无权操作");
  }

  if (input.events) {
    validateEvents(input.events);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { id },
      data: {
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate,
        deathDate: input.deathDate,
        bio: input.bio,
        aliases: input.aliases,
        generationNumber: input.generationNumber,
        generationLabel: input.generationLabel,
        nativePlace: input.nativePlace,
        notes: input.notes,
      },
    });

    if (input.events !== undefined) {
      await tx.personEvent.deleteMany({ where: { personId: id } });
      if (input.events.length > 0) {
        await tx.personEvent.createMany({
          data: input.events.map((event, index) => ({
            personId: id,
            type: event.type,
            title: event.title ?? null,
            dateLabel: event.dateLabel ?? null,
            location: event.location ?? null,
            description: event.description ?? null,
            sortOrder: event.sortOrder ?? index,
          })),
        });
      }
    }

    return person;
  });

  revalidatePath("/tree");
  revalidatePath(`/person/${id}`);
  return updated;
}

export async function deletePerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) {
    throw new Error("无权操作");
  }

  await prisma.personEvent.deleteMany({ where: { personId: id } });
  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });
  await prisma.person.delete({ where: { id } });

  revalidatePath("/tree");
}

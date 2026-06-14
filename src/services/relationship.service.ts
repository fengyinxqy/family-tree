"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CreateRelationshipInput {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  sortOrder?: number;
  label?: string | null;
}

async function getOwnedPersons(personAId: string, personBId: string, userId: string) {
  const [personA, personB] = await Promise.all([
    prisma.person.findUnique({ where: { id: personAId } }),
    prisma.person.findUnique({ where: { id: personBId } }),
  ]);

  if (!personA || !personB || personA.createdBy !== userId || personB.createdBy !== userId) {
    throw new Error("无权操作");
  }

  return { personA, personB };
}

type GenerationSyncClient = Pick<typeof prisma, "person" | "relationship">;

async function syncGenerationNumbersForComponent(
  tx: GenerationSyncClient,
  userId: string,
  seedPersonId: string,
  seedGenerationNumber: number,
) {
  const [persons, relationships] = await Promise.all([
    tx.person.findMany({
      where: { createdBy: userId },
      select: { id: true, generationNumber: true },
    }),
    tx.relationship.findMany({
      where: {
        personA: { createdBy: userId },
      },
      select: {
        type: true,
        personAId: true,
        personBId: true,
      },
    }),
  ]);

  const personMap = new Map(persons.map((person) => [person.id, person]));
  if (!personMap.has(seedPersonId)) {
    return;
  }

  const adjacency = new Map<string, Array<{ id: string; generation: (current: number) => number }>>();
  for (const person of persons) {
    adjacency.set(person.id, []);
  }

  for (const relationship of relationships) {
    if (relationship.type === "spouse") {
      adjacency.get(relationship.personAId)?.push({
        id: relationship.personBId,
        generation: (current) => current,
      });
      adjacency.get(relationship.personBId)?.push({
        id: relationship.personAId,
        generation: (current) => current,
      });
      continue;
    }

    adjacency.get(relationship.personAId)?.push({
      id: relationship.personBId,
      generation: (current) => current + 1,
    });
    adjacency.get(relationship.personBId)?.push({
      id: relationship.personAId,
      generation: (current) => current - 1,
    });
  }

  const computed = new Map<string, number>([[seedPersonId, seedGenerationNumber]]);
  const queue = [seedPersonId];

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const currentGeneration = computed.get(personId)!;

    for (const next of adjacency.get(personId) ?? []) {
      const nextGeneration = next.generation(currentGeneration);
      if (computed.has(next.id) && computed.get(next.id) === nextGeneration) {
        continue;
      }

      if (!computed.has(next.id)) {
        computed.set(next.id, nextGeneration);
        queue.push(next.id);
      }
    }
  }

  const minimumGeneration = Math.min(...computed.values());
  const offset = minimumGeneration < 1 ? 1 - minimumGeneration : 0;

  await Promise.all(
    [...computed.entries()].map(([personId, generationNumber]) =>
      tx.person.update({
        where: { id: personId },
        data: {
          generationNumber: generationNumber + offset,
        },
      }),
    ),
  );
}

function revalidateRelationshipPaths(personAId: string, personBId: string) {
  revalidatePath("/tree");
  revalidatePath(`/person/${personAId}`);
  revalidatePath(`/person/${personBId}`);
  revalidatePath(`/person/${personAId}/relationships`);
  revalidatePath(`/person/${personBId}/relationships`);
}

export async function createRelationship(input: CreateRelationshipInput) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("未登录");
  }

  const { personA } = await getOwnedPersons(input.personAId, input.personBId, userId);

  const duplicateWhere =
    input.type === "spouse"
      ? {
          type: "spouse" as const,
          OR: [
            { personAId: input.personAId, personBId: input.personBId },
            { personAId: input.personBId, personBId: input.personAId },
          ],
        }
      : {
          type: "child" as const,
          personAId: input.personAId,
          personBId: input.personBId,
        };

  const existing = await prisma.relationship.findFirst({ where: duplicateWhere });
  if (existing) {
    throw new Error(input.type === "spouse" ? "该配偶关系已存在" : "该父母-子女关系已存在");
  }

  const relationship = await prisma.$transaction(async (tx) => {
    const created = await tx.relationship.create({
      data: {
        type: input.type,
        personAId: input.personAId,
        personBId: input.personBId,
        sortOrder: input.sortOrder ?? 0,
        label: input.label ?? null,
      },
    });

    await syncGenerationNumbersForComponent(
      tx,
      userId,
      input.personAId,
      personA.generationNumber,
    );

    return created;
  });

  revalidateRelationshipPaths(input.personAId, input.personBId);
  return relationship;
}

export async function deleteRelationship(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  const relationship = await prisma.relationship.findUnique({
    where: { id },
    include: {
      personA: true,
      personB: true,
    },
  });

  if (
    !relationship ||
    relationship.personA.createdBy !== session.user.id ||
    relationship.personB.createdBy !== session.user.id
  ) {
    throw new Error("无权操作");
  }

  await prisma.relationship.delete({ where: { id } });
  revalidateRelationshipPaths(relationship.personAId, relationship.personBId);
}

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

function revalidateRelationshipPaths(personAId: string, personBId: string) {
  revalidatePath("/tree");
  revalidatePath(`/person/${personAId}`);
  revalidatePath(`/person/${personBId}`);
  revalidatePath(`/person/${personAId}/relationships`);
  revalidatePath(`/person/${personBId}/relationships`);
}

export async function createRelationship(input: CreateRelationshipInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  await getOwnedPersons(input.personAId, input.personBId, session.user.id);

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

  const relationship = await prisma.relationship.create({
    data: {
      type: input.type,
      personAId: input.personAId,
      personBId: input.personBId,
      sortOrder: input.sortOrder ?? 0,
      label: input.label ?? null,
    },
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

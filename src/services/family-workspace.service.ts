import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveFamilyTreeForUser, type ActiveFamilyTreeSpace } from "@/services/family-tree-space.service";
import type { RelationshipData, WorkspacePersonData } from "@/types";

export interface FamilyWorkspaceData {
  activeTree: ActiveFamilyTreeSpace;
  persons: WorkspacePersonData[];
  relationships: RelationshipData[];
}

export async function getFamilyWorkspaceData(): Promise<FamilyWorkspaceData> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany({
      where: { createdBy: session.user.id, treeId: activeTree.id },
      include: {
        events: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.relationship.findMany({
      where: {
        personA: { createdBy: session.user.id, treeId: activeTree.id },
        personB: { createdBy: session.user.id, treeId: activeTree.id },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    activeTree,
    persons: persons.map((person) => ({
      id: person.id,
      name: person.name,
      gender: person.gender as "male" | "female",
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      bio: person.bio,
      aliases: person.aliases ?? [],
      generationNumber: person.generationNumber,
      generationLabel: person.generationLabel ?? null,
      nativePlace: person.nativePlace ?? null,
      notes: person.notes ?? null,
      posX: person.posX,
      posY: person.posY,
      createdAt: person.createdAt.toISOString(),
      treeId: person.treeId,
      events: person.events.map((event) => ({
        id: event.id,
        personId: event.personId,
        type: event.type as "birth" | "death" | "marriage" | "migration" | "other",
        title: event.title,
        dateLabel: event.dateLabel,
        location: event.location,
        description: event.description,
        sortOrder: event.sortOrder,
      })),
    })),
    relationships: relationships.map((relationship) => ({
      id: relationship.id,
      type: relationship.type as "spouse" | "child",
      personAId: relationship.personAId,
      personBId: relationship.personBId,
      label: relationship.label,
      sortOrder: relationship.sortOrder,
    })),
  };
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FamilyTree from "@/components/family-tree";
import type { PersonData, RelationshipData } from "@/types";

export default async function TreePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const persons = await prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const relationships = await prisma.relationship.findMany({
    where: {
      personA: { createdBy: session.user.id },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Map Prisma results to PersonData and RelationshipData types
  const personData: PersonData[] = persons.map((p) => ({
    id: p.id,
    name: p.name,
    gender: p.gender as "male" | "female",
    birthDate: p.birthDate,
    deathDate: p.deathDate,
    bio: p.bio,
    aliases: p.aliases ?? [],
    generationLabel: p.generationLabel ?? null,
    nativePlace: p.nativePlace ?? null,
    notes: p.notes ?? null,
    posX: p.posX,
    posY: p.posY,
    createdAt: p.createdAt.toISOString(),
  }));

  const relationshipData: RelationshipData[] = relationships.map((r) => ({
    id: r.id,
    type: r.type as "spouse" | "child",
    personAId: r.personAId,
    personBId: r.personBId,
    label: r.label,
    sortOrder: r.sortOrder,
  }));

  return <FamilyTree persons={personData} relationships={relationshipData} />;
}

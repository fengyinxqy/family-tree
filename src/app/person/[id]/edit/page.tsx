import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EditPersonForm } from "./edit-form";

interface EditPersonPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPersonPage({ params }: EditPersonPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
  });

  if (!person || person.createdBy !== session.user.id) {
    redirect("/tree");
  }

  const personData = {
    id: person.id,
    name: person.name,
    gender: person.gender as "male" | "female",
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    bio: person.bio,
    createdAt: person.createdAt.toISOString(),
  };

  return <EditPersonForm person={personData} />;
}

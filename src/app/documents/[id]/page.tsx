import { redirect } from "next/navigation";
import { getMaterial } from "@/services/material.service";
import { getPersons } from "@/services/person.service";
import { MaterialDetailClient } from "@/components/material-detail-client";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let material: Awaited<ReturnType<typeof getMaterial>>;
  let persons: Awaited<ReturnType<typeof getPersons>>;
  try {
    [material, persons] = await Promise.all([getMaterial(id), getPersons()]);
  } catch {
    redirect("/documents");
  }
  return <MaterialDetailClient material={material} persons={persons} />;
}

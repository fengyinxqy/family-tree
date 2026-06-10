"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Baby, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelationshipForm } from "@/components/relationship-form";
import type { PersonData, RelationshipData } from "@/types";

export default function RelationshipsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPerson = useCallback(async () => {
    const res = await fetch(`/api/persons/${id}`);
    if (!res.ok) {
      router.push("/tree");
      return;
    }
    const data = await res.json();
    setPerson({
      id: data.id,
      name: data.name,
      gender: data.gender as "male" | "female",
      birthDate: data.birthDate,
      deathDate: data.deathDate,
      bio: data.bio,
      createdAt: data.createdAt,
    });
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  async function handleDeleteRelation(relId: string) {
    await fetch("/api/relationships", {
      method: "DELETE",
      body: JSON.stringify({ id: relId }),
      headers: { "Content-Type": "application/json" },
    });
    router.refresh();
  }

  if (loading || !person) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-800/10" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[480px]">
        {/* Navigation */}
        <div className="mb-6 flex items-center gap-3">
          <Link href={`/person/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回 {person.name}
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold">管理关系</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            为 <span className="font-medium text-foreground">{person.name}</span> 添加配偶或子女
          </p>
        </div>

        {/* Add button */}
        <Button
          onClick={() => setFormOpen(true)}
          className="mb-6 w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-900/15"
        >
          <Plus className="h-4 w-4" />
          添加关系
        </Button>

        {/* Relationship form dialog */}
        <RelationshipForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            router.refresh();
          }}
          currentPersonId={id}
        />
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Calendar,
  Users,
  Baby,
  Heart,
  ChevronRight,
  UserRound,
  Trees,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "./delete-button";
import { AddRelationButton } from "./add-relation-button";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonDetailPage({
  params,
}: PersonDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    redirect("/tree");
  }

  // Combine and categorize relationships
  const spouses: { id: string; name: string }[] = [];
  const parents: { id: string; name: string }[] = [];
  const children: { id: string; name: string }[] = [];

  for (const rel of person.relationsA) {
    if (rel.type === "spouse") {
      spouses.push({ id: rel.personB.id, name: rel.personB.name });
    } else if (rel.type === "child") {
      children.push({ id: rel.personB.id, name: rel.personB.name });
    }
  }

  for (const rel of person.relationsB) {
    if (rel.type === "spouse") {
      spouses.push({ id: rel.personA.id, name: rel.personA.name });
    } else if (rel.type === "child") {
      parents.push({ id: rel.personA.id, name: rel.personA.name });
    }
  }

  const genderLabel = person.gender === "male" ? "男" : "女";

  return (
    <div className="flex min-h-full flex-col px-4 py-8">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-800/10" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-200/15 blur-3xl dark:bg-emerald-800/8" />
        <div className="absolute left-1/3 top-1/4 h-[300px] w-[300px] rounded-full bg-amber-100/30 blur-2xl dark:bg-amber-700/5" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[640px]">
        {/* Navigation */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/tree">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              族谱
            </Button>
          </Link>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl shadow-zinc-200/50 backdrop-blur dark:shadow-zinc-900/60 dark:bg-card/60">
          {/* Header with avatar */}
          <div className="mb-8 flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-lg shadow-amber-900/20 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
              <UserRound className="h-8 w-8 text-amber-50" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 pt-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {person.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/60 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {genderLabel}
                </span>
                {person.birthDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {person.birthDate}
                    {person.deathDate ? ` - ${person.deathDate}` : " - 至今"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio section */}
          {person.bio && (
            <div className="mb-8 rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {person.bio}
              </p>
            </div>
          )}

          {/* Relationships section */}
          <div className="space-y-5">
            {/* Spouses */}
            {spouses.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Heart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  配偶
                </h2>
                <div className="space-y-1.5">
                  {spouses.map((spouse) => (
                    <Link
                      key={spouse.id}
                      href={`/person/${spouse.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-amber-50/50 hover:border-amber-200/60 dark:hover:bg-amber-900/10 dark:hover:border-amber-800/30"
                    >
                      <span className="font-medium">{spouse.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Parents */}
            {parents.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  父母
                </h2>
                <div className="space-y-1.5">
                  {parents.map((parent) => (
                    <Link
                      key={parent.id}
                      href={`/person/${parent.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-emerald-50/50 hover:border-emerald-200/60 dark:hover:bg-emerald-900/10 dark:hover:border-emerald-800/30"
                    >
                      <span className="font-medium">{parent.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Children */}
            {children.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Baby className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  子女
                </h2>
                <div className="space-y-1.5">
                  {children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/person/${child.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-sky-50/50 hover:border-sky-200/60 dark:hover:bg-sky-900/10 dark:hover:border-sky-800/30"
                    >
                      <span className="font-medium">{child.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* If no relationships */}
            {spouses.length === 0 &&
              parents.length === 0 &&
              children.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 px-5 py-6 text-center">
                  <Trees className="mx-auto h-5 w-5 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    暂无关系记录，去族谱页面添加关系吧
                  </p>
                </div>
              )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
            <Link href={`/person/${person.id}/edit`}>
              <Button
                variant="outline"
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                编辑
              </Button>
            </Link>
            <AddRelationButton personId={person.id} />
            <DeleteButton personId={person.id} personName={person.name} />
          </div>
        </div>

        {/* Footer: link to tree */}
        <div className="mt-6 text-center">
          <Link
            href="/tree"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-amber-700 hover:underline dark:hover:text-amber-400"
          >
            <Trees className="h-4 w-4" />
            返回家族树
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Baby,
  Heart,
  Loader2,
  Sparkles,
  Trees,
  UserRound,
  Users,
} from "lucide-react";
import { AppPage, AppPanel } from "@/components/app-surface";
import { Button } from "@/components/ui/button";
import { RelationshipForm } from "@/components/relationship-form";
import type { PersonData } from "@/types";

export default function RelationshipsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPerson() {
      try {
        const res = await fetch(`/api/persons/${id}`);
        if (!res.ok) {
          router.push("/tree");
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setPerson({
          id: data.id,
          name: data.name,
          gender: data.gender as "male" | "female",
          birthDate: data.birthDate,
          deathDate: data.deathDate,
          bio: data.bio,
          aliases: data.aliases ?? [],
          generationNumber: data.generationNumber ?? 1,
          generationLabel: data.generationLabel ?? null,
          nativePlace: data.nativePlace ?? null,
          notes: data.notes ?? null,
          posX: data.posX ?? null,
          posY: data.posY ?? null,
          createdAt: data.createdAt,
          treeId: data.treeId,
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          router.push("/tree");
        }
      }
    }

    void fetchPerson();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading || !person) {
    return (
      <AppPage centered>
        <div className="flex h-full items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            正在加载关系维护页...
          </div>
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/person/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回 {person.name}
            </Button>
          </Link>
        </div>

        <AppPanel className="bg-card/80 p-1.5">
          <div className="grid gap-6 rounded-[1.45rem] border border-border/60 bg-background/78 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <UserRound className="size-7" strokeWidth={1.8} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">关系维护工作区</p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                    为 {person.name} 添加家族关系
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    从这里快速补充配偶、父母或子女关系，维持和家族树、人物详情页一致的维护体验。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.35rem] border border-rose-200/70 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/35">
                  <Heart className="h-4 w-4 text-rose-500" />
                  <p className="mt-3 text-sm font-medium text-foreground">配偶关系</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    建立婚姻或伴侣关系，让家族横向连接更完整。
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/35">
                  <Users className="h-4 w-4 text-emerald-500" />
                  <p className="mt-3 text-sm font-medium text-foreground">父母关系</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    为当前人物补录父母，完善上一代谱系来源。
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-sky-200/70 bg-sky-50/80 p-4 dark:border-sky-900 dark:bg-sky-950/35">
                  <Baby className="h-4 w-4 text-sky-500" />
                  <p className="mt-3 text-sm font-medium text-foreground">子女关系</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    继续向下一代延展家族树，补足纵向血缘连接。
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/60 bg-card/70 p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="size-5" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">开始维护</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    点击下方按钮后，会弹出关系表单，你可以直接选择目标人物并指定关系类型。
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <Button
                  onClick={() => setFormOpen(true)}
                  className="h-11 w-full justify-center gap-2"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4" />
                  添加关系
                </Button>
                <Link href={`/person/${id}`} className="block">
                  <Button variant="outline" className="w-full justify-start gap-1.5">
                    <UserRound className="h-4 w-4" />
                    返回人物详情
                  </Button>
                </Link>
                <Link href="/tree" className="block">
                  <Button variant="ghost" className="w-full justify-start gap-1.5">
                    <Trees className="h-4 w-4" />
                    回到家族树
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </AppPanel>

        <RelationshipForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            router.refresh();
          }}
          currentPersonId={id}
        />
      </div>
    </AppPage>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Baby,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Pencil,
  Sparkles,
  Tag,
  Trees,
  UserRound,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { AppPage, AppPanel } from "@/components/app-surface";
import { Button } from "@/components/ui/button";
import { AddRelationButton } from "./add-relation-button";
import { DeleteButton } from "./delete-button";
import { DeleteRelationButton } from "./delete-relation-button";
import { getPerson } from "@/services/person.service";
import type { PersonEventData } from "@/types";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

interface RelationEntry {
  personId: string;
  name: string;
  relationId: string;
  label: string | null;
}

interface TimelineEvent {
  type: "birth" | "death" | "marriage" | "migration" | "other";
  title: string;
  dateLabel: string | null;
  location: string | null;
  description: string | null;
  isSystem: boolean;
}

const EVENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  birth: Sparkles,
  death: BookOpen,
  marriage: Heart,
  migration: MapPin,
  other: Clock,
};

const EVENT_STYLES: Record<string, string> = {
  birth:
    "border-emerald-300/70 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  death:
    "border-zinc-300/70 bg-zinc-50/90 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200",
  marriage:
    "border-rose-300/70 bg-rose-50/90 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  migration:
    "border-sky-300/70 bg-sky-50/90 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  other:
    "border-amber-300/70 bg-amber-50/90 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
};

function buildRelationEntries(person: Awaited<ReturnType<typeof getPerson>>) {
  const spouses: RelationEntry[] = [];
  const parents: RelationEntry[] = [];
  const children: RelationEntry[] = [];

  for (const rel of person.relationsA) {
    if (rel.type === "spouse") {
      spouses.push({
        personId: rel.personB.id,
        name: rel.personB.name,
        relationId: rel.id,
        label: rel.label,
      });
    } else if (rel.type === "child") {
      children.push({
        personId: rel.personB.id,
        name: rel.personB.name,
        relationId: rel.id,
        label: rel.label,
      });
    }
  }

  for (const rel of person.relationsB) {
    if (rel.type === "spouse") {
      spouses.push({
        personId: rel.personA.id,
        name: rel.personA.name,
        relationId: rel.id,
        label: rel.label,
      });
    } else if (rel.type === "child") {
      parents.push({
        personId: rel.personA.id,
        name: rel.personA.name,
        relationId: rel.id,
        label: rel.label,
      });
    }
  }

  return { spouses, parents, children };
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    birth: "出生",
    death: "离世",
    marriage: "婚姻",
    migration: "迁徙",
    other: "事件",
  };

  return labels[type] ?? "事件";
}

function buildTimeline(
  birthDate: string | null,
  deathDate: string | null,
  customEvents: PersonEventData[],
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  if (birthDate && !customEvents.some((event) => event.type === "birth")) {
    timeline.push({
      type: "birth",
      title: "出生",
      dateLabel: birthDate,
      location: null,
      description: null,
      isSystem: true,
    });
  }

  if (deathDate && !customEvents.some((event) => event.type === "death")) {
    timeline.push({
      type: "death",
      title: "离世",
      dateLabel: deathDate,
      location: null,
      description: null,
      isSystem: true,
    });
  }

  for (const event of customEvents) {
    timeline.push({
      type: event.type as TimelineEvent["type"],
      title: event.title || eventTypeLabel(event.type),
      dateLabel: event.dateLabel,
      location: event.location,
      description: event.description,
      isSystem: false,
    });
  }

  timeline.sort((a, b) => {
    if (!a.dateLabel && !b.dateLabel) return 0;
    if (!a.dateLabel) return 1;
    if (!b.dateLabel) return -1;
    return a.dateLabel.localeCompare(b.dateLabel);
  });

  return timeline;
}

function DetailSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <AppPanel className="bg-card/84 p-1.5">
      <section className="rounded-[1.45rem] border border-border/60 bg-background/82 p-5 lg:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {children}
      </section>
    </AppPanel>
  );
}

function RelationSection({
  title,
  icon: Icon,
  colorClass,
  entries,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
  entries: RelationEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.relationId}
            className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:border-border hover:bg-card/90"
          >
            <Link
              href={`/person/${entry.personId}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                {entry.label ? (
                  <p className="truncate text-xs text-muted-foreground">{entry.label}</p>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <DeleteRelationButton relationId={entry.relationId} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  let person: Awaited<ReturnType<typeof getPerson>>;
  try {
    person = await getPerson(id);
  } catch {
    redirect("/tree");
  }

  const { spouses, parents, children } = buildRelationEntries(person);
  const timeline = buildTimeline(person.birthDate, person.deathDate, person.events);
  const genderLabel = person.gender === "male" ? "男" : "女";
  const lifeRange = person.birthDate
    ? `${person.birthDate}${person.deathDate ? ` - ${person.deathDate}` : " - 至今"}`
    : null;
  const hasArchiveFields =
    person.aliases.length > 0 || person.generationLabel || person.nativePlace || person.notes;
  const hasAnyRelation = spouses.length > 0 || parents.length > 0 || children.length > 0;

  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/tree">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回家族树
            </Button>
          </Link>
        </div>

        <AppPanel className="bg-card/80 p-1.5">
          <div className="grid gap-6 rounded-[1.45rem] border border-border/60 bg-background/78 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-7">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
                  <UserRound className="size-8" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">人物详情档案</p>
                    <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                      {person.name}
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      在这里查看成员档案、人生事件与家族关系，整体视觉已对齐家族树工作台。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {genderLabel}
                    </span>
                    {lifeRange ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/85 px-3 py-1 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {lifeRange}
                      </span>
                    ) : null}
                    {person.generationLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/85 px-3 py-1 text-xs text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                        {person.generationLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {person.bio ? (
                <div className="rounded-[1.35rem] border border-border/60 bg-card/70 px-5 py-4">
                  <p className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                    {person.bio}
                  </p>
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-border/60 px-5 py-4 text-sm text-muted-foreground">
                  还没有填写人物简介，可以去编辑页补充这位成员的生平与背景。
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.35rem] border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/35">
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {parents.length}
                </p>
                <p className="mt-1 text-sm text-emerald-900/75 dark:text-emerald-100/75">父母关系</p>
              </div>
              <div className="rounded-[1.35rem] border border-rose-200/70 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/35">
                <p className="text-2xl font-semibold text-rose-700 dark:text-rose-300">
                  {spouses.length}
                </p>
                <p className="mt-1 text-sm text-rose-900/75 dark:text-rose-100/75">配偶关系</p>
              </div>
              <div className="rounded-[1.35rem] border border-sky-200/70 bg-sky-50/80 p-4 dark:border-sky-900 dark:bg-sky-950/35">
                <p className="text-2xl font-semibold text-sky-700 dark:text-sky-300">
                  {children.length}
                </p>
                <p className="mt-1 text-sm text-sky-900/75 dark:text-sky-100/75">子女关系</p>
              </div>
            </div>
          </div>
        </AppPanel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {hasArchiveFields ? (
              <DetailSection
                icon={BookOpen}
                title="档案信息"
                description="补充人物身份、来源和维护备注，和编辑页里的字段结构保持一致。"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {person.aliases.length > 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:col-span-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">别名</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {person.aliases.map((alias) => (
                          <span
                            key={alias}
                            className="inline-flex items-center rounded-full border border-amber-200/70 bg-amber-50/90 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {person.generationLabel ? (
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">排行 / 代际</p>
                      <p className="mt-2 text-sm text-foreground">{person.generationLabel}</p>
                    </div>
                  ) : null}

                  {person.nativePlace ? (
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">籍贯</p>
                      <p className="mt-2 text-sm text-foreground">{person.nativePlace}</p>
                    </div>
                  ) : null}

                  {person.notes ? (
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:col-span-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">维护备注</p>
                      <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                        {person.notes}
                      </p>
                    </div>
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            {timeline.length > 0 ? (
              <DetailSection
                icon={Clock}
                title="人生事件"
                description="将出生、离世和补充事件整理成一条时间线，阅读体验更接近人物档案。"
              >
                <div className="relative space-y-4 pl-5">
                  <div className="absolute bottom-0 left-[7px] top-1 w-px bg-border/70" />
                  {timeline.map((event, index) => {
                    const Icon = EVENT_ICONS[event.type] ?? Clock;
                    const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.other;

                    return (
                      <div key={`${event.type}-${index}`} className="relative">
                        <div className="absolute -left-[17px] top-5 h-3.5 w-3.5 rounded-full border-2 border-primary/30 bg-background" />
                        <div className={`rounded-[1.35rem] border px-4 py-3 ${style}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{event.title}</span>
                            {event.isSystem ? (
                              <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] opacity-70">
                                system
                              </span>
                            ) : null}
                            {event.dateLabel ? (
                              <span className="ml-auto text-xs font-medium opacity-80">
                                {event.dateLabel}
                              </span>
                            ) : null}
                          </div>
                          {event.location || event.description ? (
                            <div className="mt-2 space-y-1.5 text-xs leading-6 opacity-85">
                              {event.location ? (
                                <p className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {event.location}
                                </p>
                              ) : null}
                              {event.description ? <p>{event.description}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection
              icon={Trees}
              title="家族关系"
              description="关系摘要和成员列表统一整理在同一块区域，便于从详情页继续维护家族树。"
            >
              {hasAnyRelation ? (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/35">
                      <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {parents.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">父母</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 text-center dark:border-rose-900 dark:bg-rose-950/35">
                      <p className="text-xl font-semibold text-rose-700 dark:text-rose-300">
                        {spouses.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">配偶</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-4 text-center dark:border-sky-900 dark:bg-sky-950/35">
                      <p className="text-xl font-semibold text-sky-700 dark:text-sky-300">
                        {children.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">子女</p>
                    </div>
                  </div>

                  <RelationSection
                    title="配偶"
                    icon={Heart}
                    colorClass="text-rose-500"
                    entries={spouses}
                  />
                  <RelationSection
                    title="父母"
                    icon={Users}
                    colorClass="text-emerald-500"
                    entries={parents}
                  />
                  <RelationSection
                    title="子女"
                    icon={Baby}
                    colorClass="text-sky-500"
                    entries={children}
                  />
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-border/60 px-5 py-8 text-center">
                  <Trees className="mx-auto h-5 w-5 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">还没有记录家族关系</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    可以从这里继续添加配偶、父母或子女，让家族树逐步完整起来。
                  </p>
                  <div className="mt-4 flex justify-center">
                    <AddRelationButton personId={person.id} className="w-full justify-center" />
                  </div>
                </div>
              )}
            </DetailSection>
          </div>

          <div className="space-y-6">
            <DetailSection
              icon={Tag}
              title="快捷操作"
              description="把最常用的维护动作固定在侧边，减少页面来回查找。"
            >
              <div className="space-y-3">
                <Link href={`/person/${person.id}/edit`} className="block">
                  <Button variant="outline" className="w-full justify-start gap-1.5">
                    <Pencil className="h-4 w-4" />
                    编辑人物档案
                  </Button>
                </Link>
                <div className="w-full">
                  <AddRelationButton personId={person.id} className="w-full justify-start" />
                </div>
                <DeleteButton personId={person.id} personName={person.name} />
              </div>
            </DetailSection>

            <AppPanel className="bg-card/84 p-1.5">
              <div className="rounded-[1.45rem] border border-border/60 bg-background/82 p-5">
                <p className="text-sm font-medium text-foreground">返回家族树</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  回到总览继续查看其他成员，或从树上继续调整结构。
                </p>
                <div className="mt-4">
                  <Link href="/tree">
                    <Button variant="ghost" className="w-full justify-start gap-1.5">
                      <Trees className="h-4 w-4" />
                      打开家族树工作台
                    </Button>
                  </Link>
                </div>
              </div>
            </AppPanel>
          </div>
        </div>
      </div>
    </AppPage>
  );
}

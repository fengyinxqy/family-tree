import { auth } from "@/lib/auth";
import { getPerson } from "@/services/person.service";
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
  MapPin,
  Tag,
  BookOpen,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "./delete-button";
import { AddRelationButton } from "./add-relation-button";
import { DeleteRelationButton } from "./delete-relation-button";
import type { PersonEventData } from "@/types";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

// ── 关系摘要 ───────────────────────────────────────────────

interface RelationEntry {
  personId: string;
  name: string;
  relationId: string;
  label: string | null;
}

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

// ── 时间线事件 ─────────────────────────────────────────────

interface TimelineEvent {
  type: "birth" | "death" | "marriage" | "migration" | "other";
  title: string;
  dateLabel: string | null;
  location: string | null;
  description: string | null;
  isSystem: boolean; // 是否系统派生
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  birth: Sparkles,
  death: BookOpen,
  marriage: Heart,
  migration: MapPin,
  other: Clock,
};

const EVENT_COLORS: Record<string, string> = {
  birth: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  death: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  marriage: "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
  migration: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  other: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

function buildTimeline(
  birthDate: string | null,
  deathDate: string | null,
  customEvents: PersonEventData[],
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  // 系统派生的出生事件
  if (birthDate) {
    const hasCustomBirth = customEvents.some((e) => e.type === "birth");
    if (!hasCustomBirth) {
      timeline.push({
        type: "birth",
        title: "出生",
        dateLabel: birthDate,
        location: null,
        description: null,
        isSystem: true,
      });
    }
  }

  // 系统派生的离世事件
  if (deathDate) {
    const hasCustomDeath = customEvents.some((e) => e.type === "death");
    if (!hasCustomDeath) {
      timeline.push({
        type: "death",
        title: "离世",
        dateLabel: deathDate,
        location: null,
        description: null,
        isSystem: true,
      });
    }
  }

  // 自定义事件
  for (const e of customEvents) {
    timeline.push({
      type: e.type as TimelineEvent["type"],
      title: e.title || eventTypeLabel(e.type),
      dateLabel: e.dateLabel,
      location: e.location,
      description: e.description,
      isSystem: false,
    });
  }

  // 按日期排序：有日期的在前，无日期的在后
  timeline.sort((a, b) => {
    if (!a.dateLabel && !b.dateLabel) return 0;
    if (!a.dateLabel) return 1;
    if (!b.dateLabel) return -1;
    return a.dateLabel.localeCompare(b.dateLabel);
  });

  return timeline;
}

function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    birth: "出生",
    death: "离世",
    marriage: "婚姻",
    migration: "迁徙",
    other: "事件",
  };
  return labels[type] ?? "事件";
}

// ── 主页面组件 ─────────────────────────────────────────────

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

  // 关系摘要
  const hasAnyRelation = spouses.length > 0 || parents.length > 0 || children.length > 0;
  const hasArchiveFields =
    person.aliases.length > 0 || person.generationLabel || person.nativePlace || person.notes;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-800/10" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-200/15 blur-3xl dark:bg-emerald-800/8" />
        <div className="absolute left-1/3 top-1/4 h-[300px] w-[300px] rounded-full bg-amber-100/30 blur-2xl dark:bg-amber-700/5" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

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
          {/* Header */}
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
                    {person.deathDate ? " - " + person.deathDate : " - 至今"}
                  </span>
                )}
                {person.generationLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {person.generationLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {person.bio && (
            <div className="mb-8 rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {person.bio}
              </p>
            </div>
          )}

          {/* ── 档案信息区 (4.2) ── */}
          {hasArchiveFields && (
            <div className="mb-8 rounded-xl border border-border/60 bg-muted/20 px-5 py-4 space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                档案信息
              </h2>

              {person.aliases.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">别名</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {person.aliases.map((alias, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-md bg-amber-100/60 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {person.generationLabel && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">排行/代际</span>
                  <p className="mt-0.5 text-sm">{person.generationLabel}</p>
                </div>
              )}

              {person.nativePlace && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      籍贯
                    </span>
                  </span>
                  <p className="mt-0.5 text-sm">{person.nativePlace}</p>
                </div>
              )}

              {person.notes && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">维护备注</span>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{person.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── 事件时间线 (4.3) ── */}
          {timeline.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                人生事件
              </h2>
              <div className="relative pl-5 border-l-2 border-border/60 space-y-4">
                {timeline.map((event, i) => {
                  const Icon = EVENT_ICONS[event.type] ?? Clock;
                  const colorClass = EVENT_COLORS[event.type] ?? EVENT_COLORS.other;
                  return (
                    <div key={i} className="relative">
                      {/* 时间轴圆点 */}
                      <div
                        className={
                          "absolute -left-[calc(1.25rem+5px)] top-1 h-2.5 w-2.5 rounded-full border-2 " +
                          (event.type === "birth"
                            ? "border-emerald-500 bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-900"
                            : event.type === "death"
                              ? "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800"
                              : "border-amber-400 bg-amber-100 dark:border-amber-500 dark:bg-amber-900")
                        }
                      />

                      <div className={"rounded-lg border px-4 py-3 " + colorClass}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-sm font-medium">{event.title}</span>
                          {event.isSystem && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">
                              系统
                            </span>
                          )}
                          {event.dateLabel && (
                            <span className="ml-auto text-xs tabular-nums opacity-80">
                              {event.dateLabel}
                            </span>
                          )}
                        </div>
                        {(event.location || event.description) && (
                          <div className="mt-1.5 text-xs opacity-80 space-y-0.5">
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                            {event.description && <p>{event.description}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 关系区 (4.1 + 4.4) ── */}
          <div className="space-y-5">
            {/* 关系摘要卡 */}
            {hasAnyRelation && (
              <div className="mb-2 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Tag className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  关系摘要
                </h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-emerald-50/60 px-3 py-2 dark:bg-emerald-900/20">
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                      {parents.length}
                    </div>
                    <div className="text-xs text-muted-foreground">父母</div>
                  </div>
                  <div className="rounded-lg bg-pink-50/60 px-3 py-2 dark:bg-pink-900/20">
                    <div className="text-lg font-semibold text-pink-700 dark:text-pink-300">
                      {spouses.length}
                    </div>
                    <div className="text-xs text-muted-foreground">配偶</div>
                  </div>
                  <div className="rounded-lg bg-sky-50/60 px-3 py-2 dark:bg-sky-900/20">
                    <div className="text-lg font-semibold text-sky-700 dark:text-sky-300">
                      {children.length}
                    </div>
                    <div className="text-xs text-muted-foreground">子女</div>
                  </div>
                </div>
              </div>
            )}

            {/* Spouses */}
            {spouses.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  配偶
                </h2>
                <div className="space-y-1.5">
                  {spouses.map((spouse) => (
                    <div
                      key={spouse.relationId}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-pink-50/50 hover:border-pink-200/60 dark:hover:bg-pink-900/10 dark:hover:border-pink-800/30"
                    >
                      <Link
                        href={"/person/" + spouse.personId}
                        className="flex-1 flex items-center justify-between"
                      >
                        <span className="font-medium">
                          {spouse.name}
                          {spouse.label && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({spouse.label})
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <DeleteRelationButton relationId={spouse.relationId} />
                    </div>
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
                    <div
                      key={parent.relationId}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-emerald-50/50 hover:border-emerald-200/60 dark:hover:bg-emerald-900/10 dark:hover:border-emerald-800/30"
                    >
                      <Link
                        href={"/person/" + parent.personId}
                        className="flex-1 flex items-center justify-between"
                      >
                        <span className="font-medium">
                          {parent.name}
                          {parent.label && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({parent.label})
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <DeleteRelationButton relationId={parent.relationId} />
                    </div>
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
                    <div
                      key={child.relationId}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm transition-colors hover:bg-sky-50/50 hover:border-sky-200/60 dark:hover:bg-sky-900/10 dark:hover:border-sky-800/30"
                    >
                      <Link
                        href={"/person/" + child.personId}
                        className="flex-1 flex items-center justify-between"
                      >
                        <span className="font-medium">
                          {child.name}
                          {child.label && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({child.label})
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <DeleteRelationButton relationId={child.relationId} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!hasAnyRelation && (
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
            <Link href={"/person/" + person.id + "/edit"}>
              <Button variant="outline" className="gap-1.5">
                <Pencil className="h-4 w-4" />
                编辑
              </Button>
            </Link>
            <AddRelationButton personId={person.id} />
            <DeleteButton personId={person.id} personName={person.name} />
          </div>
        </div>

        {/* Footer */}
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

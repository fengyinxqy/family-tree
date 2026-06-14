import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { AppPanel } from "@/components/app-surface";
import { getFamilyWorkspaceData } from "@/services/family-workspace.service";
import { getRootPersonIds } from "@/lib/family-graph";

export default async function AncestorsPage() {
  const { persons, relationships } = await getFamilyWorkspaceData();
  const rootIds = getRootPersonIds(persons, relationships);
  const roots = persons.filter((person) => rootIds.includes(person.id));

  return (
    <WorkspaceRouteShell
      eyebrow="Ancestors"
      title="祖先入口"
      description="这里先收纳家族中的根人物与祖先候选，方便从不同源头重新进入树、分支图与人物档案。"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roots.map((person) => (
          <AppPanel key={person.id} className="p-1.5">
            <div className="rounded-[1.45rem] border border-border/70 bg-background/82 p-5">
              <p className="text-sm text-muted-foreground">祖系入口</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground">{person.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {person.birthDate || "?"}
                {person.deathDate ? ` - ${person.deathDate}` : ""}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/tree?view=branch&personId=${person.id}`} className="text-sm font-medium text-primary hover:underline">
                  打开分支图
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/person/${person.id}`} className="text-sm font-medium text-primary hover:underline">
                  查看档案
                </Link>
              </div>
            </div>
          </AppPanel>
        ))}
        {roots.length === 0 ? (
          <AppPanel className="p-1.5 md:col-span-2 xl:col-span-3">
            <div className="rounded-[1.45rem] border border-dashed border-border/70 bg-background/82 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">当前家谱里还没有可识别的祖先根节点。</p>
              <Link href="/tree" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                去家谱工作台补录成员
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </AppPanel>
        ) : null}
      </div>
    </WorkspaceRouteShell>
  );
}

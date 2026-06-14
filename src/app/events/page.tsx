import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { buildWorkspaceTimeline } from "@/lib/family-graph";
import { AppPanel } from "@/components/app-surface";
import { getFamilyWorkspaceData } from "@/services/family-workspace.service";

export default async function EventsPage() {
  const { persons, relationships } = await getFamilyWorkspaceData();
  const timeline = buildWorkspaceTimeline(persons, relationships);

  return (
    <WorkspaceRouteShell
      eyebrow="Events"
      title="家族时间轴"
      description="把人物事件与系统推导出的生卒里程碑整合到一个阅读入口里，便于从“时间”而不是“结构”来浏览家族。"
    >
      <div className="space-y-4">
        {timeline.map((entry) => (
          <AppPanel key={entry.id} className="p-1.5">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.45rem] border border-border/70 bg-background/82 p-5">
              <div>
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{entry.personName}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {entry.description || entry.location || "暂无附加说明"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">{entry.dateLabel || "未标注时间"}</div>
            </div>
          </AppPanel>
        ))}
      </div>
    </WorkspaceRouteShell>
  );
}

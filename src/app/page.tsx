import Link from "next/link";
import { BookOpen, Clock3, GitBranch, Trees } from "lucide-react";
import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { AppPanel } from "@/components/app-surface";
import { Button } from "@/components/ui/button";
import { getFamilyWorkspaceData } from "@/services/family-workspace.service";
import { getRootPersonIds } from "@/lib/family-graph";

export default async function Home() {
  const { persons, relationships } = await getFamilyWorkspaceData();
  const roots = getRootPersonIds(persons, relationships);

  return (
    <WorkspaceRouteShell
      eyebrow="Family Hub"
      title="家族工作台"
      description="从这里进入家谱、事件、祖先与资料空间。当前首页先聚焦总览和常用入口，帮助你快速回到正在维护的家族结构。"
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "成员总数", value: `${persons.length} 位`, icon: Trees },
            { label: "关系条目", value: `${relationships.length} 条`, icon: GitBranch },
            { label: "祖先根节点", value: `${roots.length} 位`, icon: BookOpen },
            {
              label: "已记录事件",
              value: `${persons.reduce((sum, person) => sum + person.events.length, 0)} 条`,
              icon: Clock3,
            },
          ].map((item) => (
            <AppPanel key={item.label} className="p-1.5">
              <div className="rounded-[1.45rem] border border-border/70 bg-background/82 p-5">
                <item.icon className="size-5 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-3xl font-semibold text-foreground">{item.value}</p>
              </div>
            </AppPanel>
          ))}
        </div>

        <AppPanel className="p-1.5">
          <div className="rounded-[1.45rem] border border-border/70 bg-background/82 p-6">
            <h2 className="text-xl font-semibold text-foreground">快捷入口</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              这轮产品骨架已经铺开，你可以从这里直接回到最核心的四个工作区。
            </p>
            <div className="mt-5 grid gap-3">
              <Button render={<Link href="/tree" />} className="justify-start">
                打开家谱工作台
              </Button>
              <Button render={<Link href="/ancestors" />} variant="outline" className="justify-start">
                查看祖先入口
              </Button>
              <Button render={<Link href="/events" />} variant="outline" className="justify-start">
                浏览家族时间轴
              </Button>
              <Button render={<Link href="/settings" />} variant="outline" className="justify-start">
                调整工作台偏好
              </Button>
            </div>
          </div>
        </AppPanel>
      </div>
    </WorkspaceRouteShell>
  );
}

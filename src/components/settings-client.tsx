"use client";

import { useState } from "react";
import { Bot, PanelsTopLeft, Trees } from "lucide-react";
import { AppPanel } from "@/components/app-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const VIEW_OPTIONS = [
  { value: "tree", label: "树状图" },
  { value: "table", label: "世系表" },
  { value: "timeline", label: "时间轴" },
  { value: "branch", label: "分支图" },
] as const;

type DefaultView = (typeof VIEW_OPTIONS)[number]["value"];
type PanelState = "assistant" | "collapsed";

export function SettingsClient() {
  const [defaultView, setDefaultView] = useState<DefaultView>(() => {
    if (typeof window === "undefined") {
      return "tree";
    }
    return (window.localStorage.getItem("family.workspace.defaultView") as DefaultView | null) ?? "tree";
  });
  const [panelState, setPanelState] = useState<PanelState>(() => {
    if (typeof window === "undefined") {
      return "assistant";
    }
    return (window.localStorage.getItem("family.workspace.panel") as PanelState | null) ?? "assistant";
  });

  function persistView(nextView: DefaultView) {
    setDefaultView(nextView);
    window.localStorage.setItem("family.workspace.defaultView", nextView);
  }

  function persistPanel(nextPanel: PanelState) {
    setPanelState(nextPanel);
    window.localStorage.setItem("family.workspace.panel", nextPanel);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AppPanel className="p-1.5">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Trees className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">默认工作台视图</h2>
              <p className="text-sm text-muted-foreground">当你打开家谱页且 URL 没有指定视图时，优先进入这里设置的默认视图。</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={defaultView === option.value ? "default" : "outline"}
                onClick={() => persistView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </AppPanel>

      <AppPanel className="p-1.5">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">助手面板状态</h2>
              <p className="text-sm text-muted-foreground">默认决定工作台右侧助手是展开还是折叠。</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant={panelState === "assistant" ? "default" : "outline"}
              onClick={() => persistPanel("assistant")}
            >
              展开助手
            </Button>
            <Button
              variant={panelState === "collapsed" ? "default" : "outline"}
              onClick={() => persistPanel("collapsed")}
            >
              默认折叠
            </Button>
          </div>
        </div>
      </AppPanel>

      <AppPanel className="p-1.5 xl:col-span-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <PanelsTopLeft className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">当前偏好摘要</h2>
              <p className="text-sm text-muted-foreground">这些设置会在没有显式 query 参数时应用到家谱工作台。</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Badge variant="secondary">默认视图：{VIEW_OPTIONS.find((option) => option.value === defaultView)?.label}</Badge>
            <Badge variant="secondary">助手状态：{panelState === "assistant" ? "展开" : "折叠"}</Badge>
          </div>
        </div>
      </AppPanel>
    </div>
  );
}

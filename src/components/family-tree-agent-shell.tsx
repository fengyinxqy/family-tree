"use client";

import { useState } from "react";
import { Bot, PanelRightClose } from "lucide-react";
import { AgentPanel } from "@/components/agent-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FamilyTreeAgentShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <>
      {desktopOpen ? (
        <aside className="app-panel hidden min-h-0 w-[400px] shrink-0 border-l border-border/70 xl:flex">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-end border-b border-border/70 px-3 py-3">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setDesktopOpen(false)}
                aria-label="收起家谱助手面板"
                title="收起家谱助手面板"
              >
                <PanelRightClose />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <AgentPanel />
            </div>
          </div>
        </aside>
      ) : null}

      {!desktopOpen ? (
        <div className="fixed right-4 bottom-4 z-50 hidden xl:block">
          <Button
            size="lg"
            onClick={() => setDesktopOpen(true)}
            className="shadow-[0_18px_40px_color-mix(in_oklch,var(--foreground)_14%,transparent)]"
          >
            <Bot data-icon="inline-start" />
            家谱助手
          </Button>
        </div>
      ) : null}

      <div className="fixed right-4 bottom-4 z-50 xl:hidden">
        <Button size="lg" onClick={() => setMobileOpen(true)}>
          <Bot data-icon="inline-start" />
          家谱助手
        </Button>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] overflow-hidden border-border/70 bg-card/95 p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>家谱助手</DialogTitle>
            <DialogDescription>录入家谱信息并推理人物关系。</DialogDescription>
          </DialogHeader>
          <div className="h-[80vh]">
            <AgentPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

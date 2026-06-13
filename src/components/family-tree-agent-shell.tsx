"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden min-h-0 w-[380px] shrink-0 overflow-y-auto border-l bg-background/85 backdrop-blur xl:block">
        <AgentPanel />
      </aside>

      <div className="fixed right-4 bottom-4 z-50 xl:hidden">
        <Button size="lg" onClick={() => setOpen(true)}>
          <Bot data-icon="inline-start" />
          家谱 Agent
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>家谱 Agent</DialogTitle>
            <DialogDescription>家谱录入与亲属关系问答面板。</DialogDescription>
          </DialogHeader>
          <div className="h-[80vh]">
            <AgentPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

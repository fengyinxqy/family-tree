"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MemberSearch } from "@/components/member-search";
import type { PersonData } from "@/types";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [persons, setPersons] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 打开时懒加载人员数据
  useEffect(() => {
    if (!open || persons.length > 0) return;

    let cancelled = false;
    setLoading(true);

    fetch("/api/persons")
      .then((res) => res.json())
      .then((data: Array<Record<string, unknown>>) => {
        if (cancelled) return;
        const mapped: PersonData[] = data.map((p) => ({
          id: p.id as string,
          name: p.name as string,
          gender: p.gender as "male" | "female",
          birthDate: (p.birthDate as string) ?? null,
          deathDate: (p.deathDate as string) ?? null,
          bio: (p.bio as string) ?? null,
          aliases: (p.aliases as string[]) ?? [],
          generationNumber: (p.generationNumber as number) ?? 1,
          generationLabel: (p.generationLabel as string) ?? null,
          nativePlace: (p.nativePlace as string) ?? null,
          notes: (p.notes as string) ?? null,
          posX: (p.posX as number) ?? null,
          posY: (p.posY as number) ?? null,
          createdAt: p.createdAt as string,
          treeId: p.treeId as string,
        }));
        setPersons(mapped);
      })
      .catch(() => {
        // 加载失败时静默处理
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, persons.length]);

  // Ctrl+K / Cmd+K 快捷键
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (personId: string) => {
      setOpen(false);
      router.push(`/person/${personId}`);
    },
    [router],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 py-2 text-left transition-colors hover:bg-card hover:border-border lg:flex"
        aria-label="搜索人物、事件、文献..."
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          搜索人物、事件、文献...
        </span>
        <kbd className="ml-auto rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          K
        </kbd>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : persons.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              暂无人员数据
            </div>
          ) : (
            <MemberSearch
              persons={persons}
              onSelect={handleSelect}
              onClear={() => {}}
              highlightedNodeId={null}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PersonData } from "@/types";

interface MemberSearchProps {
  persons: PersonData[];
  onSelect: (personId: string) => void;
  onClear: () => void;
  highlightedNodeId: string | null;
}

export function MemberSearch({
  persons,
  onSelect,
  onClear,
  highlightedNodeId,
}: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? persons
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (personId: string) => {
      onSelect(personId);
      const person = persons.find((p) => p.id === personId);
      if (person) setQuery(person.name);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onSelect, persons],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filtered.length === 0) {
        if (e.key === "Escape") handleClear();
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            handleSelect(filtered[activeIndex].id);
          }
          break;
        case "Escape":
          handleClear();
          break;
      }
    },
    [isOpen, filtered, activeIndex, handleSelect, handleClear],
  );

  const highlightMatch = (name: string, q: string) => {
    if (!q.trim()) return name;
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">
          {name.slice(idx, idx + q.length)}
        </mark>
        {name.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="搜索成员姓名..."
          className="h-10 pl-9 pr-9 text-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="size-3.5" />
          </button>
        ) : highlightedNodeId ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {isOpen && filtered.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-[0_18px_40px_color-mix(in_oklch,var(--foreground)_12%,transparent)] backdrop-blur-xl">
          <div className="px-2 py-1.5">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              找到 {filtered.length} 位匹配成员
            </p>
          </div>
          <div className="border-t border-border/50" />
          {filtered.map((person, index) => {
            const isMale = person.gender === "male";
            const birthYear = person.birthDate
              ? new Date(person.birthDate).getFullYear()
              : null;
            const deathYear = person.deathDate
              ? new Date(person.deathDate).getFullYear()
              : null;

            return (
              <button
                key={person.id}
                type="button"
                onClick={() => handleSelect(person.id)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  index === activeIndex
                    ? "bg-primary/8"
                    : "hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    isMale
                      ? "border-secondary/40 bg-secondary/10 text-secondary-foreground"
                      : "border-accent/40 bg-accent/10 text-accent-foreground",
                  )}
                >
                  <UserRound className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {highlightMatch(person.name, query)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isMale ? "男" : "女"}
                    {birthYear ? ` · ${birthYear}` : ""}
                    {deathYear ? ` – ${deathYear}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* No results */}
      {isOpen && query.trim() && filtered.length === 0 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-6 text-center shadow-lg backdrop-blur-xl">
          <p className="text-sm text-muted-foreground">未找到匹配的成员</p>
        </div>
      ) : null}
    </div>
  );
}

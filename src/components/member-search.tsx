"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, X, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  filterMemberSearchResults,
  formatMemberSearchMeta,
} from "@/lib/member-search";
import type { PersonData } from "@/types";

interface MemberSearchProps {
  persons: PersonData[];
  onSelect: (personId: string) => void;
  onClear: () => void;
  onSearchStart?: () => void;
  highlightedNodeId: string | null;
}

export function MemberSearch({
  persons,
  onSelect,
  onClear,
  onSearchStart,
  highlightedNodeId,
}: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterMemberSearchResults(persons, query),
    [persons, query],
  );
  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (personId: string) => {
      onSelect(personId);
      const person = persons.find((item) => item.id === personId);
      if (person) {
        setQuery(person.name);
      }
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
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filtered.length === 0) {
        if (event.key === "Escape") {
          handleClear();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((previous) =>
            previous < filtered.length - 1 ? previous + 1 : 0,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((previous) =>
            previous > 0 ? previous - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          event.preventDefault();
          if (safeActiveIndex >= 0) {
            handleSelect(filtered[safeActiveIndex].person.id);
          }
          break;
        case "Escape":
          handleClear();
          break;
      }
    },
    [filtered, handleClear, handleSelect, isOpen, safeActiveIndex],
  );

  const highlightMatch = (name: string, currentQuery: string) => {
    if (!currentQuery.trim()) return name;
    const index = name.toLocaleLowerCase("zh-CN").indexOf(
      currentQuery.toLocaleLowerCase("zh-CN"),
    );
    if (index === -1) return name;

    return (
      <>
        {name.slice(0, index)}
        <mark className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">
          {name.slice(index, index + currentQuery.length)}
        </mark>
        {name.slice(index + currentQuery.length)}
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
          onChange={(event) => {
            if (highlightedNodeId) {
              onSearchStart?.();
            }
            setQuery(event.target.value);
            setIsOpen(Boolean(event.target.value.trim()));
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (query.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="搜索成员姓名或别名..."
          className="h-10 pl-9 pr-9 text-sm"
        />
        {query || highlightedNodeId ? (
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

      {isOpen && filtered.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-[0_18px_40px_color-mix(in_oklch,var(--foreground)_12%,transparent)] backdrop-blur-xl">
          <div className="px-2 py-1.5">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              找到 {filtered.length} 位匹配成员
            </p>
          </div>
          <div className="border-t border-border/50" />
          {filtered.map((match, index) => {
            const person = match.person;
            const isMale = person.gender === "male";
            const meta = formatMemberSearchMeta(person);

            return (
              <button
                key={person.id}
                type="button"
                onClick={() => handleSelect(person.id)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  index === safeActiveIndex ? "bg-primary/8" : "hover:bg-muted/60",
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
                    {meta.genderLabel}
                    {meta.birthYear ? ` · ${meta.birthYear}` : ""}
                    {meta.deathYear ? ` - ${meta.deathYear}` : ""}
                    {match.matchedBy === "alias" && person.aliases.length > 0
                      ? ` · 别名：${person.aliases[0]}`
                      : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {isOpen && query.trim() && filtered.length === 0 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-6 text-center shadow-lg backdrop-blur-xl">
          <p className="text-sm text-muted-foreground">未找到匹配的成员</p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowRight, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonData } from "@/types";

type PersonNodeData = PersonData & {
  spouseIds: string[];
  childrenIds: string[];
  parentIds: string[];
};

function PersonNodeComponent({ data, selected }: NodeProps) {
  const person = data as unknown as PersonNodeData & { highlighted?: boolean };
  const isMale = person.gender === "male";
  const highlighted = person.highlighted ?? false;
  const birthYear = person.birthDate
    ? new Date(person.birthDate).getFullYear()
    : "?";
  const deathYear = person.deathDate
    ? new Date(person.deathDate).getFullYear()
    : "";

  const palette = isMale
    ? {
        frame:
          "from-[color-mix(in_oklch,var(--card)_92%,white_8%)] to-[color-mix(in_oklch,var(--secondary)_28%,white_72%)]",
        border:
          "border-[color-mix(in_oklch,var(--secondary)_55%,var(--border))]",
        accent:
          "bg-[color-mix(in_oklch,var(--secondary)_72%,var(--primary)_28%)]",
      }
    : {
        frame:
          "from-[color-mix(in_oklch,var(--card)_90%,white_10%)] to-[color-mix(in_oklch,var(--accent)_20%,white_80%)]",
        border: "border-[color-mix(in_oklch,var(--accent)_42%,var(--border))]",
        accent:
          "bg-[color-mix(in_oklch,var(--accent)_72%,var(--primary)_28%)]",
      };

  return (
    <div
      className={cn(
        "group relative transition-transform duration-300 ease-out",
        selected ? "z-30 scale-[1.04]" : "z-10 hover:scale-[1.02]",
      )}
    >
      {selected ? (
        <div
          aria-hidden="true"
          className="absolute -inset-1 rounded-[1.4rem] border border-primary/20 bg-primary/8 shadow-[0_0_0_6px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
        />
      ) : null}

      {highlighted && !selected ? (
        <div
          aria-hidden="true"
          className="absolute -inset-1.5 animate-pulse rounded-[1.55rem] border-2 border-amber-400/60 bg-amber-300/10 shadow-[0_0_0_10px_color-mix(in_oklch,var(--color-amber-400)_18%,transparent),0_0_24px_4px_color-mix(in_oklch,var(--color-amber-300)_25%,transparent)]"
        />
      ) : null}

      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!top-[-6px] !size-3 !border-2 !border-background !bg-primary shadow-sm"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!bottom-[-6px] !size-3 !border-2 !border-background !bg-primary shadow-sm"
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!left-[-6px] !size-3 !border-2 !border-background !bg-primary shadow-sm"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!right-[-6px] !size-3 !border-2 !border-background !bg-primary shadow-sm"
      />

      <div
        className={cn(
          "app-frosted relative flex w-[200px] items-start gap-3 overflow-hidden rounded-[1.35rem] border px-3.5 py-3 text-left shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_10%,transparent)] transition-all duration-200",
          "bg-gradient-to-br",
          palette.frame,
          palette.border,
        )}
      >
        <div
          aria-hidden="true"
          className={cn("absolute inset-x-0 top-0 h-1.5", palette.accent)}
        />

        <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/55 text-primary shadow-sm">
          <UserRound strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[1.02rem] font-semibold tracking-tight text-foreground">
            {person.name}
          </p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <span className="inline-block rounded-full border border-border/80 bg-background/65 px-2 py-0.5">
              {isMale ? "男" : "女"}
            </span>
            <div>
              {birthYear}
              {deathYear ? ` - ${deathYear}` : ""}
            </div>
          </div>
        </div>

        <Link
          href={`/person/${person.id}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/65 text-muted-foreground transition-colors hover:text-primary"
          aria-label={`查看 ${person.name} 档案`}
        >
          <ArrowRight
            className="size-4 transition-colors group-hover:text-primary"
            strokeWidth={1.8}
          />
        </Link>
      </div>
    </div>
  );
}

export const PersonNode = React.memo(PersonNodeComponent);

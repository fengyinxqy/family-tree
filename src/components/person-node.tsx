"use client";

import React from "react";
import Link from "next/link";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Calendar, UserRound } from "lucide-react";
import type { PersonData } from "@/types";

type PersonNodeData = PersonData & {
  spouseIds: string[];
  childrenIds: string[];
  parentIds: string[];
};

function PersonNodeComponent({ data, selected }: NodeProps) {
  const person = data as unknown as PersonNodeData;
  const isMale = person.gender === "male";

  // Format dates for display
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : "?";
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : "";

  const genderColors = isMale
    ? {
        bg: "from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/30",
        border: "border-sky-200/70 dark:border-sky-700/40",
        accent: "from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500",
        icon: "text-sky-600 dark:text-sky-400",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
        ring: "ring-sky-400/60 dark:ring-sky-500/50",
        hover: "hover:border-sky-300/80 dark:hover:border-sky-600/60",
      }
    : {
        bg: "from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/30",
        border: "border-rose-200/70 dark:border-rose-700/40",
        accent: "from-rose-400 to-pink-500 dark:from-rose-400 dark:to-pink-400",
        icon: "text-rose-500 dark:text-rose-400",
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        ring: "ring-rose-400/60 dark:ring-rose-500/50",
        hover: "hover:border-rose-300/80 dark:hover:border-rose-600/60",
      };

  return (
    <div
      className={`
        group relative
        transition-all duration-300 ease-out
        ${selected ? "scale-110 z-30" : "z-10 hover:scale-[1.03]"}
      `}
    >
      {/* Selected ring highlight */}
      {selected && (
        <div
          className={`
            absolute -inset-1.5 rounded-2xl
            ring-2 ring-offset-2 ring-offset-transparent
            ${genderColors.ring}
            animate-in fade-in zoom-in-95 duration-300
          `}
          aria-hidden="true"
        />
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !border-2 !border-white dark:!border-zinc-800 !w-3 !h-3 !top-[-6px] transition-transform hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !border-2 !border-white dark:!border-zinc-800 !w-3 !h-3 !bottom-[-6px] transition-transform hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-amber-400 !border-2 !border-white dark:!border-zinc-800 !w-3 !h-3 !left-[-6px] transition-transform hover:!scale-125"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!bg-amber-400 !border-2 !border-white dark:!border-zinc-800 !w-3 !h-3 !right-[-6px] transition-transform hover:!scale-125"
      />

      {/* Card */}
      <Link
        href={`/person/${person.id}`}
        className={`
          flex items-center gap-3 w-[170px] px-3.5 py-3
          rounded-xl
          bg-gradient-to-br ${genderColors.bg}
          border ${genderColors.border}
          backdrop-blur
          shadow-md shadow-zinc-200/60 dark:shadow-zinc-900/80
          ${genderColors.hover}
          cursor-pointer
          transition-all duration-200
          ${selected
            ? `shadow-xl ${isMale ? "shadow-sky-200/50" : "shadow-rose-200/50"} dark:shadow-zinc-950`
            : ""
          }
        `}
        onClick={(e) => {
          // Stop propagation so React Flow doesn't steal the click
          e.stopPropagation();
        }}
      >
        {/* Avatar */}
        <div
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center
            rounded-xl
            bg-gradient-to-br ${genderColors.accent}
            shadow-md ${isMale ? "shadow-sky-900/15" : "shadow-rose-900/15"}
            ring-1 ring-white/20 dark:ring-white/10
          `}
        >
          <UserRound className="h-4.5 w-4.5 text-white" strokeWidth={1.8} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground truncate">
            {person.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`
                inline-flex items-center rounded-full px-1.5 py-0.5
                text-[10px] font-medium leading-none
                ${genderColors.badge}
              `}
            >
              {isMale ? "男" : "女"}
            </span>
            <span className="text-[11px] text-muted-foreground/80 truncate">
              {birthYear}{deathYear ? `-${deathYear}` : ""}
            </span>
          </div>
        </div>

        {/* Subtle arrow indicator on hover */}
        <div className="shrink-0 w-4">
          <svg
            className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-amber-500/60 transition-colors duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}

export const PersonNode = React.memo(PersonNodeComponent);

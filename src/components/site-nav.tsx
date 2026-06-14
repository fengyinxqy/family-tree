"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/tree", label: "家谱" },
  { href: "/ancestors", label: "祖先" },
  { href: "/events", label: "事件" },
  { href: "/documents", label: "文献" },
  { href: "/albums", label: "相册" },
  { href: "/hall", label: "祠堂" },
  { href: "/settings", label: "设置" },
];

export function SiteNav({ userLabel }: { userLabel: string | null }) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
      <nav className="hidden items-center gap-1 xl:flex">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-card/80 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 py-2 lg:flex">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">搜索人物、事件、文献</span>
        <kbd className="rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          K
        </kbd>
      </div>

      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-card/75 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="通知"
      >
        <Bell className="size-4" />
      </button>

      <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 py-1.5 md:flex">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {(userLabel?.[0] || "家").toUpperCase()}
        </div>
        <span className="max-w-28 truncate text-sm text-foreground">{userLabel || "家谱用户"}</span>
      </div>
    </div>
  );
}

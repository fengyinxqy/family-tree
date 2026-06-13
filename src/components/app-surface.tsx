import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppPageProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  centered?: boolean;
}

export function AppBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 top-0 h-[380px] w-[380px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[-12%] right-[-10%] h-[420px] w-[420px] rounded-full bg-secondary/35 blur-3xl" />
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 48%, transparent) calc(100% - 1px)), linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), color-mix(in oklch, var(--border) 44%, transparent) calc(100% - 1px))",
          backgroundSize: "120px 120px",
        }}
      />
    </div>
  );
}

export function AppPage({
  children,
  centered = false,
  className,
  ...props
}: AppPageProps) {
  return (
    <div
      className={cn("relative flex flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      <AppBackdrop />
      <div
        className={cn(
          "relative z-10 flex flex-1 min-h-0 flex-col px-4 py-6 sm:px-6 lg:px-8",
          centered ? "justify-center" : "overflow-y-auto",
        )}
      >
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AppPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "app-panel rounded-[1.75rem] border border-border/70",
        className,
      )}
      {...props}
    />
  );
}

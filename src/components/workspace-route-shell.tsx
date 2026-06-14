import type { ReactNode } from "react";
import { AppPage, AppPanel } from "@/components/app-surface";

export function WorkspaceRouteShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
          <div className="space-y-2">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </AppPage>
  );
}

export function EmptyFeaturePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppPanel className="p-1.5">
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/82 px-6 py-12 text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
      </div>
    </AppPanel>
  );
}

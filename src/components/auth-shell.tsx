import type { ReactNode } from "react";
import Link from "next/link";
import { ScrollText, Sparkles } from "lucide-react";
import { AppPage, AppPanel } from "@/components/app-surface";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description: string;
  eyebrow: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  title,
  description,
  eyebrow,
  footer,
  children,
}: AuthShellProps) {
  return (
    <AppPage centered>
      <div className="flex items-center justify-center py-6">
        <div className="grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
          <Card className="app-panel hidden border border-border/70 bg-card/80 xl:flex">
            <CardHeader className="gap-6 pb-0">
              <Link href="/tree" className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <ScrollText strokeWidth={1.8} />
                </div>
                <div>
                  <CardTitle className="text-[1.35rem]">家谱档案</CardTitle>
                  <CardDescription>与家族树页面保持一致的关系工作台体验</CardDescription>
                </div>
              </Link>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-8 pt-8">
              <div className="space-y-5">
                <div className="space-y-3">
                  <Badge variant="secondary" className="w-fit">
                    <Sparkles data-icon="inline-start" />
                    {eyebrow}
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">结构清晰</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      登录、注册和成员编辑都回到同一套卡片层级、间距与色彩体系。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">操作连续</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      从身份进入，到录入成员，再回到家族树，页面体验不再割裂。
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                推荐在桌面端使用右侧表单卡片，移动端则会自然折叠为单列，保留同样的层级和留白。
              </div>
            </CardContent>
          </Card>

          <AppPanel className="flex items-center bg-card/84 p-3 sm:p-4">
            <div className="w-full rounded-[1.45rem] border border-border/60 bg-background/82 p-5 shadow-sm shadow-black/5 sm:p-7">
              <div className="mb-6 xl:hidden">
                <Link href="/tree" className="inline-flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <ScrollText strokeWidth={1.8} className="size-5" />
                  </div>
                  <div>
                    <p className="font-heading text-lg font-semibold text-foreground">家谱档案</p>
                    <p className="text-sm text-muted-foreground">{eyebrow}</p>
                  </div>
                </Link>
              </div>
              {children}
              <div className="mt-6 border-t border-border/60 pt-5 text-center text-sm text-muted-foreground">
                {footer}
              </div>
            </div>
          </AppPanel>
        </div>
      </div>
    </AppPage>
  );
}

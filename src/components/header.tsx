import Link from "next/link";
import { ScrollText, Waypoints } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 box-border h-[var(--app-header-height)] border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/tree" className="group flex min-w-0 items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/14">
            <ScrollText strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
                家谱档案
              </span>
              <Badge variant="outline" className="hidden sm:inline-flex">
                族谱工作台
              </Badge>
            </div>
          </div>
        </Link>

        {session?.user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Waypoints className="size-4 text-primary" strokeWidth={1.8} />
              <span className="max-w-56 truncate">{session.user.email}</span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                退出
              </Button>
            </form>
          </div>
        ) : (
          <Button render={<Link href="/login" />} variant="outline" size="sm">
            登录
          </Button>
        )}
      </div>
    </header>
  );
}

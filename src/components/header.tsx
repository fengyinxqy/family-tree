import Link from "next/link";
import { ScrollText } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 box-border h-[var(--app-header-height)] border-b border-border/70 bg-background/72 backdrop-blur-xl">
      <div className="flex h-full w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/14">
            <ScrollText strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-[1.6rem] font-semibold tracking-tight text-foreground">
              家谱云
            </div>
            <p className="hidden text-xs tracking-[0.24em] text-muted-foreground sm:block">
              传承有序 生生不息
            </p>
          </div>
        </Link>

        <SiteNav userLabel={session?.user?.email ?? null} />

        {session?.user ? (
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
        ) : (
          <Button render={<Link href="/login" />} variant="outline" size="sm">
            登录
          </Button>
        )}
      </div>
    </header>
  );
}

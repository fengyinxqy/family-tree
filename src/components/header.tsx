import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="h-16 border-b bg-white/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
      <Link href="/tree" className="text-xl font-bold flex items-center gap-2">
        <span className="text-amber-600">🌳</span>
        <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
          家谱
        </span>
      </Link>
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              退出
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}

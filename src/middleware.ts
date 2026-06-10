import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/tree", "/person", "/api/persons", "/api/relationships"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  // 检查显式配置的 NextAuth session cookie
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/tree/:path*", "/person/:path*", "/api/persons/:path*", "/api/relationships/:path*"],
};

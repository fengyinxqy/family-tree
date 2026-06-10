import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 受保护的路由
const protectedPaths = ["/tree", "/person", "/api/persons", "/api/relationships"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  // 检查 NextAuth session cookie（避免 import prisma，Edge Runtime 不支持原生模块）
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/tree/:path*", "/person/:path*", "/api/persons/:path*", "/api/relationships/:path*"],
};

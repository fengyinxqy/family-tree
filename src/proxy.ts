import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPaths = [
  "/tree",
  "/person",
  "/documents",
  "/reviews",
  "/settings",
  "/api/persons",
  "/api/relationships",
  "/api/materials",
  "/api/family",
  "/api/revisions",
  "/api/revision-groups",
  "/api/agent",
  "/api/import-export",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!protectedPaths.some((path) => pathname.startsWith(path))) return NextResponse.next();

  // Proxy 只做乐观会话检查；所有家族授权仍由路由和 DAL 在每次请求中执行。
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: "next-auth.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/tree/:path*",
    "/person/:path*",
    "/documents/:path*",
    "/reviews/:path*",
    "/settings/:path*",
    "/api/persons/:path*",
    "/api/relationships/:path*",
    "/api/materials/:path*",
    "/api/family/:path*",
    "/api/revisions/:path*",
    "/api/revision-groups/:path*",
    "/api/agent/:path*",
    "/api/import-export/:path*",
  ],
};

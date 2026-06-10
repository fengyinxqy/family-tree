export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/tree/:path*", "/person/:path*", "/api/persons/:path*", "/api/relationships/:path*"],
};

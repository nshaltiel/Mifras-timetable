import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Protect /admin routes - only for SUPER_ADMIN
  if (pathname.startsWith("/admin")) {
    const isSuperAdmin = (session?.user as Record<string, unknown>)?.isSuperAdmin;
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes - must be logged in and NOT super admin
  if (
    pathname.startsWith("/(dashboard)") ||
    ["/", "/absences", "/substitutions", "/settings", "/timetable"].includes(pathname)
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)"],
};

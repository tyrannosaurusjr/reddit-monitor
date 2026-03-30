import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const { pathname } = req.nextUrl;

  // Allow auth routes, login page, and public API routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, PROTECTED_PATHS } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (pathname.startsWith("/api/")) setCorsHeaders(request, response);
  return response;
}

function setCorsHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:10086").split(",");
  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

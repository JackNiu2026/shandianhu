import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, PROTECTED_PATHS, verifyToken } from "@/lib/auth";

/** 公开 API 路由前缀（无需认证） */
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/parent/login",
  "/api/auth/parent/register",
  "/api/public/",
];

/** 仅管理员可访问的 API 路由前缀 */
const ADMIN_API_PREFIXES = [
  "/api/teachers",
  "/api/parents",
  "/api/bookings",
  "/api/reviews",
  "/api/memberships",
  "/api/finance",
  "/api/content",
  "/api/dashboard",
  "/api/auth/me",
  "/api/auth/change-password",
];

/**
 * 认证中间件
 * - 页面路由：检查 admin-token Cookie，未登录重定向到 /login
 * - API 路由：检查 token 有效性，管理端路由拒绝家长 token
 * - 已登录访问 /login 重定向到 /dashboard
 * - API 路由动态设置 CORS Allow-Origin（基于请求 Origin 头白名单匹配）
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || undefined;

  // ---- 页面路由保护 ----
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  const isLoginPage = pathname === "/login";

  if (isProtected) {
    if (!token || !verifyToken(token)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isLoginPage && token && verifyToken(token)) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // ---- API 路由保护 ----
  if (pathname.startsWith("/api/")) {
    // 公开 API 路由放行
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      const response = NextResponse.next();
      setCorsHeaders(request, response);
      return response;
    }

    // 验证 token 存在且有效
    const decoded = token ? verifyToken(token) : null;
    if (!decoded) {
      const response = NextResponse.json(
        { error: "未登录或 Token 已过期" },
        { status: 401 },
      );
      setCorsHeaders(request, response);
      return response;
    }

    // 管理端 API 路由：拒绝家长 token
    if (ADMIN_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      if (decoded.role !== "superadmin") {
        const response = NextResponse.json(
          { error: "权限不足，需要管理员身份" },
          { status: 403 },
        );
        setCorsHeaders(request, response);
        return response;
      }
    }

    const response = NextResponse.next();
    setCorsHeaders(request, response);
    return response;
  }

  return NextResponse.next();
}

/**
 * 动态 CORS 源设置：基于请求 Origin 头匹配白名单
 * 解决 Allow-Origin: * + Allow-Credentials: true 违反规范的问题
 */
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

/**
 * 中间件匹配配置
 * 匹配所有路径，排除静态资源
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

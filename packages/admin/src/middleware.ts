import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, PROTECTED_PATHS } from "@/lib/auth";

/**
 * 认证中间件
 * - 检查 admin-token Cookie
 * - 受保护路由未登录重定向到 /login?callbackUrl=原路径
 * - 已登录访问 /login 重定向到 /dashboard
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // 判断是否为受保护路由
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  // 判断是否为登录页
  const isLoginPage = pathname === "/login";

  // 受保护路由但未登录 → 重定向到登录页
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 已登录访问登录页 → 重定向到看板
  if (isLoginPage && token) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

/**
 * 中间件匹配配置
 * 匹配所有路径，排除静态资源和 API 路由
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     * - 公共资源
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

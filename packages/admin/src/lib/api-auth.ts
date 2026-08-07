/**
 * API 路由认证辅助工具
 * 用于在 API Route Handler 中验证管理员身份
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "./auth";

/**
 * 从请求中提取 token（支持 Cookie 和 Authorization 头）
 */
function extractToken(request: NextRequest): string | undefined {
  // 优先从 Cookie 读取
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  // 兼容移动端 Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return undefined;
}

/**
 * 从请求中验证用户身份（管理员和家长均可）
 * @param request NextRequest 对象
 * @returns 验证成功返回用户信息，失败返回 401 响应
 */
export function authenticateRequest(request: NextRequest):
  | { username: string; role: string; response: null }
  | { username: null; role: null; response: NextResponse } {
  const token = extractToken(request);

  if (!token) {
    return {
      username: null,
      role: null,
      response: NextResponse.json(
        { error: "未登录，请先登录" },
        { status: 401 },
      ),
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return {
      username: null,
      role: null,
      response: NextResponse.json(
        { error: "Token 无效或已过期，请重新登录" },
        { status: 401 },
      ),
    };
  }

  return { username: decoded.username, role: decoded.role, response: null };
}

/**
 * 仅允许管理员访问（role: superadmin）
 * 用于管理端 API 路由，拒绝家长 token
 */
export function authenticateAdmin(request: NextRequest):
  | { username: string; role: string; response: null }
  | { username: null; role: null; response: NextResponse } {
  const auth = authenticateRequest(request);
  if (auth.response) return auth;

  if (auth.role !== "superadmin") {
    return {
      username: null,
      role: null,
      response: NextResponse.json(
        { error: "权限不足，需要管理员身份" },
        { status: 403 },
      ),
    };
  }

  return auth;
}

/**
 * 统一错误处理包装器
 * 用于包裹 API Route Handler，自动捕获异常并返回 500
 */
export function withErrorHandler<T extends (...args: never[]) => Promise<NextResponse>>(
  handler: T,
): T {
  return (async (...args: never[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[API Error]", error);
      const message = error instanceof Error ? error.message : "服务器内部错误";
      return NextResponse.json(
        { error: message },
        { status: 500 },
      );
    }
  }) as T;
}

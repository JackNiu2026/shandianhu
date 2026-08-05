/**
 * API 路由认证辅助工具
 * 用于在 API Route Handler 中验证管理员身份
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "./auth";

/**
 * 从请求中验证管理员身份
 * @param request NextRequest 对象
 * @returns 验证成功返回用户信息，失败返回 401 响应
 */
export function authenticateRequest(request: NextRequest):
  | { username: string; role: string; response: null }
  | { username: null; role: null; response: NextResponse } {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

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

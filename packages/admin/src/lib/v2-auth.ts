import { AppError, resolveSession } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";

/**
 * 从 V2 用户请求中解析已认证用户 ID。
 *
 * 所有面向 C 端（移动端）的 V2 API 端点共用此鉴权入口：
 * 读取 Authorization: Bearer <token> 头，校验 session 并返回 userId。
 * 失败抛 AppError("UNAUTHENTICATED", 401)，由 toHttpResponse 统一转 HTTP 响应。
 */
export async function authenticatedUserId(request: NextRequest): Promise<string> {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  }

  return (await resolveSession(token)).userId;
}

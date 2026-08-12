import { AppError, wechatLogin } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";

/**
 * 微信小程序登录公开端点（无需认证）。
 * 接收 { code } 调用 wechatLogin，返回 { token, userId }。
 */
export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    let body: { code?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    if (!body?.code || typeof body.code !== "string") {
      throw new AppError("VALIDATION_ERROR", 400, "Missing wechat code");
    }
    return await wechatLogin(body.code);
  });
}

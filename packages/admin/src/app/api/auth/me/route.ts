/**
 * GET /api/auth/me
 * 返回当前登录的管理员信息
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    return NextResponse.json({
      user: {
        username: auth.username,
        role: auth.role,
      },
    });
  } catch (error) {
    console.error("[Me Error]", error);
    return NextResponse.json(
      { error: "获取用户信息失败" },
      { status: 500 },
    );
  }
}

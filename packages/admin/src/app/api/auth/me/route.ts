/**
 * GET /api/auth/me
 * 返回当前登录的管理员信息
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/api-auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
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

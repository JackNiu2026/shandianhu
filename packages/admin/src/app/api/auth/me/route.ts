/**
 * GET /api/auth/me
 * 返回当前登录的管理员信息
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "未登录" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: "Token 无效或已过期" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        username: decoded.username,
        role: decoded.role,
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

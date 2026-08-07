/**
 * POST /api/auth/logout
 * 清除认证 cookie
 */
import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("[Logout Error]", error);
    return NextResponse.json(
      { error: "退出登录失败" },
      { status: 500 },
    );
  }
}

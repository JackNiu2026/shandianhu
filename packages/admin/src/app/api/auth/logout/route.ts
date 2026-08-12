import { NextRequest, NextResponse } from "next/server";
import { revokeAdminSession } from "@lightning-tiger/server";
import { AUTH_COOKIE_NAME, clearAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    await revokeAdminSession(token);
    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("[Logout Error]", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

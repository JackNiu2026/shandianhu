import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@lightning-tiger/server/src/db/client";
import { AUTH_COOKIE_NAME, clearAuthCookie } from "@/lib/auth";
import { sessionTokenHash } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      await prisma.adminSession.updateMany({
        where: { tokenHash: sessionTokenHash(token), status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
    }
    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("[Logout Error]", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

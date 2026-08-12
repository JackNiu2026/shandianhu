import { NextRequest, NextResponse } from "next/server";
import { changeAdminPassword } from "@lightning-tiger/server";
import { clearAuthCookie } from "@/lib/auth";
import { authenticateAdmin } from "@/lib/api-auth";
import { changePasswordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.response) return auth.response;

    const result = changePasswordSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }

    const changeResult = await changeAdminPassword(
      auth.adminUserId,
      result.data.currentPassword,
      result.data.newPassword,
    );
    if (changeResult === "NOT_FOUND") {
      return NextResponse.json({ error: "Administrator not found" }, { status: 404 });
    }
    if (changeResult === "CURRENT_PASSWORD_INVALID") {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("[Change Password Error]", error);
    return NextResponse.json({ error: "Password update failed" }, { status: 500 });
  }
}

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@lightning-tiger/server/src/db/client";
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

    const adminUser = await prisma.adminUser.findUnique({ where: { id: auth.adminUserId } });
    if (!adminUser) return NextResponse.json({ error: "Administrator not found" }, { status: 404 });
    if (!await bcrypt.compare(result.data.currentPassword, adminUser.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: adminUser.id },
        data: { passwordHash: await bcrypt.hash(result.data.newPassword, 10) },
      }),
      prisma.adminSession.updateMany({
        where: { adminUserId: adminUser.id, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      }),
    ]);

    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("[Change Password Error]", error);
    return NextResponse.json({ error: "Password update failed" }, { status: 500 });
  }
}

/**
 * POST /api/auth/change-password - 修改管理员密码
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { changePasswordSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    // zod 输入验证
    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = result.data;

    // 查找管理员用户
    const adminUser = await prisma.adminUser.findUnique({
      where: { username: auth.username },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 },
      );
    }

    // 验证当前密码
    const isValid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "当前密码错误" },
        { status: 400 },
      );
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Change Password Error]", error);
    return NextResponse.json(
      { error: "修改密码失败" },
      { status: 500 },
    );
  }
}

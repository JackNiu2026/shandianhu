/**
 * POST /api/auth/login
 * 验证管理员凭据，生成 JWT，设置 HttpOnly cookie
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 },
      );
    }

    // 查找管理员用户
    const adminUser = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 },
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, adminUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 },
      );
    }

    // 生成 JWT token
    const token = generateToken(adminUser.username);

    // 创建响应并设置 cookie
    const response = NextResponse.json({
      success: true,
      user: {
        username: adminUser.username,
        role: adminUser.role,
      },
    });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error("[Login Error]", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 },
    );
  }
}

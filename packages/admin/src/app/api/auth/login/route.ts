/**
 * POST /api/auth/login
 * 验证管理员凭据，生成 JWT，设置 HttpOnly cookie
 * 包含简单的登录失败计数（防暴力破解）
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

/** 简易内存登录失败计数器（生产环境应使用 Redis） */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 分钟

function getThrottleKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwardedFor = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    if (forwardedFor) {
      return forwardedFor;
    }
  }

  return "anonymous";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // zod 输入验证
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { username, password } = result.data;

    // 速率限制检查
    const clientKey = getThrottleKey(request);
    const attempts = loginAttempts.get(clientKey);
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt;
      if (elapsed < WINDOW_MS) {
        const remaining = Math.ceil((WINDOW_MS - elapsed) / 1000 / 60);
        return NextResponse.json(
          { error: `登录尝试次数过多，请 ${remaining} 分钟后再试` },
          { status: 429 },
        );
      }
      loginAttempts.delete(clientKey);
    }

    // 查找管理员用户
    const adminUser = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!adminUser) {
      // 记录失败
      const current = loginAttempts.get(clientKey);
      loginAttempts.set(clientKey, {
        count: (current?.count || 0) + 1,
        lastAttempt: Date.now(),
      });
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 },
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, adminUser.password);
    if (!isValid) {
      const current = loginAttempts.get(clientKey);
      loginAttempts.set(clientKey, {
        count: (current?.count || 0) + 1,
        lastAttempt: Date.now(),
      });
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 },
      );
    }

    // 登录成功，清除失败计数
    loginAttempts.delete(clientKey);

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

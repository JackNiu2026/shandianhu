/**
 * POST /api/auth/parent/login - 家长登录
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parentLoginSchema } from "@/lib/validation";
import { generateToken, setAuthCookie } from "@/lib/auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = parentLoginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { phone, password } = result.data;

    const parent = await prisma.parent.findUnique({ where: { phone } });
    if (!parent || !parent.password) {
      return NextResponse.json(
        { error: "手机号或密码错误" },
        { status: 401 },
      );
    }

    const isValid = await bcrypt.compare(password, parent.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "手机号或密码错误" },
        { status: 401 },
      );
    }

    if (parent.status === "blocked") {
      return NextResponse.json(
        { error: "账号已被封禁，请联系管理员" },
        { status: 403 },
      );
    }

    const token = generateToken(parent.id, "parent");
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
        childGrade: parent.childGrade,
      },
    });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error("[Parent Login Error]", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 },
    );
  }
}

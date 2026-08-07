/**
 * POST /api/auth/parent/register - 家长注册
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parentRegisterSchema } from "@/lib/validation";
import { generateToken, setAuthCookie } from "@/lib/auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = parentRegisterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { name, phone, password, childGrade } = result.data;

    // 检查手机号是否已注册
    const existing = await prisma.parent.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { error: "该手机号已注册" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const parent = await prisma.parent.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        childGrade,
      },
    });

    const token = generateToken(parent.id, "parent");
    const response = NextResponse.json({
      success: true,
      user: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
      },
    }, { status: 201 });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error("[Parent Register Error]", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 },
    );
  }
}

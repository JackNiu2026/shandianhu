/**
 * GET /api/auth/parent/me - 获取当前家长信息
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    // 尝试按家长 ID 查找
    const parent = await prisma.parent.findFirst({
      where: { id: auth.username },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "家长信息不存在" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: parent.id,
      name: parent.name,
      phone: parent.phone,
      avatar: parent.avatar,
      childGrade: parent.childGrade,
      bookingCount: parent.bookingCount,
      likedTeachers: (parent.likedTeachers as string[]) ?? [],
    });
  } catch (error) {
    console.error("[Parent Me Error]", error);
    return NextResponse.json(
      { error: "获取家长信息失败" },
      { status: 500 },
    );
  }
}

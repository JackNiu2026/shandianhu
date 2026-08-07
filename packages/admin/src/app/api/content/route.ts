/**
 * GET /api/content - 返回科目/学段/预算配置 + 真实平台统计
 */
import { NextRequest, NextResponse } from "next/server";
import { subjects, grades, budgetOptions } from "@lightning-tiger/shared";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const [teacherCount, parentCount] = await Promise.all([
      prisma.teacher.count(),
      prisma.parent.count(),
    ]);

    return NextResponse.json({
      subjects: [...subjects],
      grades: [...grades],
      budgetOptions: [...budgetOptions],
      platformStats: {
        teacherCount,
        parentCount,
      },
    });
  } catch (error) {
    console.error("[Content Config Error]", error);
    return NextResponse.json(
      { error: "获取内容配置失败" },
      { status: 500 },
    );
  }
}

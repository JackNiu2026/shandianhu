/**
 * GET /api/content - 返回科目/学段/预算配置 + 真实平台统计
 */
import { NextRequest, NextResponse } from "next/server";
import { subjects, grades, budgetOptions } from "@lightning-tiger/shared";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
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

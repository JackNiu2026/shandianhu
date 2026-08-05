/**
 * GET /api/content - 返回科目/学段/预算配置
 */
import { NextResponse } from "next/server";
import { subjects, grades, budgetOptions } from "@lightning-tiger/shared";

export async function GET() {
  try {
    return NextResponse.json({
      subjects: [...subjects],
      grades: [...grades],
      budgetOptions: [...budgetOptions],
      platformStats: {
        teacherCount: 856,
        parentCount: 1240,
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

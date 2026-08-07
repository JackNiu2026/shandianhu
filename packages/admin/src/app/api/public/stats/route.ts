/**
 * GET /api/public/stats - 公开平台统计数据（无需认证）
 * 返回老师总数、家长总数等公开统计信息
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [teacherCount, parentCount] = await Promise.all([
      prisma.teacher.count({ where: { status: "active" } }),
      prisma.parent.count({ where: { status: "active" } }),
    ]);

    return NextResponse.json({
      teacherCount,
      parentCount,
    });
  } catch (error) {
    console.error("[Public Stats Error]", error);
    return NextResponse.json(
      { error: "获取平台统计失败" },
      { status: 500 },
    );
  }
}

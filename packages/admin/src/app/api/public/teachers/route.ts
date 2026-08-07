/**
 * GET /api/public/teachers - 公开老师列表（无需认证）
 * 返回所有 active 状态的老师，格式兼容移动端 Teacher 类型
 * 限制最多返回 100 条，使用安全 JSON 解析
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeTeacher } from "@/lib/serialize";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject") || "";
    const grade = searchParams.get("grade") || "";

    const where: Record<string, unknown> = { status: "active" };

    if (subject) {
      where.subject = subject;
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        reviews: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { rating: "desc" },
      take: 100,
    });

    // 序列化 + 安全 JSON 解析
    let result = teachers.map((t) => ({
      ...serializeTeacher(t),
      reviews: t.reviews.map((r) => ({
        id: r.id,
        by: r.author,
        text: r.text,
        rating: r.rating,
      })),
    }));

    // 过滤学段（grades 是 JSON 字符串，需在内存中过滤）
    if (grade) {
      result = result.filter((t) => (t.grades as string[]).includes(grade));
    }

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Public Teachers Error]", error);
    return NextResponse.json(
      { error: "获取老师列表失败" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/public/reviews - 家长端创建评价（使用家长认证）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { createReviewSchema } from "@/lib/validation";
import { serializeReview } from "@/lib/serialize";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    // 安全检查：仅家长可创建评价
    if (auth.role !== "parent") {
      return NextResponse.json(
        { error: "仅家长可创建评价" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = createReviewSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { teacherId, text, rating } = result.data;

    // 从认证用户获取家长信息，防止伪造作者
    const parent = await prisma.parent.findUnique({
      where: { id: auth.username },
      select: { name: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "家长信息不存在" }, { status: 404 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return NextResponse.json({ error: "老师不存在" }, { status: 404 });
    }

    const review = await prisma.review.create({
      data: { teacherId, author: parent.name, text, rating },
      include: { teacher: true },
    });

    return NextResponse.json(serializeReview(review), { status: 201 });
  } catch (error) {
    console.error("[Public Review Create Error]", error);
    return NextResponse.json(
      { error: "创建评价失败" },
      { status: 500 },
    );
  }
}

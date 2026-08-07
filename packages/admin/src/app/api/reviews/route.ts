/**
 * GET /api/reviews - 评价列表（支持 status/teacherId 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeReview } from "@/lib/serialize";
import { createReviewSchema, parsePagination } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const teacherId = searchParams.get("teacherId") || "";
    const { skip, take, page, pageSize } = parsePagination(searchParams);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { teacher: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.review.count({ where }),
    ]);

    const result = reviews.map(serializeReview);

    return NextResponse.json({ data: result, total, page, pageSize });
  } catch (error) {
    console.error("[Reviews List Error]", error);
    return NextResponse.json(
      { error: "获取评价列表失败" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/reviews - 创建评价
 */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const result = createReviewSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { teacherId, author, text, rating } = result.data;

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return NextResponse.json({ error: "老师不存在" }, { status: 404 });
    }

    const review = await prisma.review.create({
      data: { teacherId, author, text, rating },
      include: { teacher: true },
    });

    return NextResponse.json(serializeReview(review), { status: 201 });
  } catch (error) {
    console.error("[Review Create Error]", error);
    return NextResponse.json(
      { error: "创建评价失败" },
      { status: 500 },
    );
  }
}

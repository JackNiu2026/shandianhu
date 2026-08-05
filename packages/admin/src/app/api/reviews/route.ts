/**
 * GET /api/reviews - 评价列表（支持 status/teacherId 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeReview } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const teacherId = searchParams.get("teacherId") || "";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    const reviews = await prisma.review.findMany({
      where,
      include: { teacher: true },
      orderBy: { createdAt: "desc" },
    });

    const result = reviews.map(serializeReview);

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Reviews List Error]", error);
    return NextResponse.json(
      { error: "获取评价列表失败" },
      { status: 500 },
    );
  }
}

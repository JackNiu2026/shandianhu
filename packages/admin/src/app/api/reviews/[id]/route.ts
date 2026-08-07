/**
 * PATCH  /api/reviews/[id] - 更新评价状态
 * DELETE /api/reviews/[id] - 删除评价
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeReview } from "@/lib/serialize";
import { updateReviewStatusSchema } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证认证
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();

    // zod 输入验证
    const result = updateReviewStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { status } = result.data;

    // 检查评价是否存在
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "评价不存在" },
        { status: 404 },
      );
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status },
      include: { teacher: true },
    });

    return NextResponse.json(serializeReview(review));
  } catch (error) {
    console.error("[Review Update Error]", error);
    return NextResponse.json(
      { error: "更新评价状态失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证认证
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    // 检查评价是否存在
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "评价不存在" },
        { status: 404 },
      );
    }

    await prisma.review.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Review Delete Error]", error);
    return NextResponse.json(
      { error: "删除评价失败" },
      { status: 500 },
    );
  }
}

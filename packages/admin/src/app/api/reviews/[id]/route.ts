/**
 * PATCH  /api/reviews/[id] - 更新评价状态
 * DELETE /api/reviews/[id] - 删除评价
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeReview } from "@/lib/serialize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证认证
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // 验证 status 值
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "无效的评价状态" },
        { status: 400 },
      );
    }

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
    const auth = authenticateRequest(request);
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

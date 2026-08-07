/**
 * GET    /api/memberships/[id] - 获取会员详情
 * PATCH  /api/memberships/[id] - 更新会员状态
 * DELETE /api/memberships/[id] - 删除会员
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeMembership } from "@/lib/serialize";
import { updateMembershipStatusSchema } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { parent: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "会员不存在" },
        { status: 404 },
      );
    }

    return NextResponse.json(serializeMembership(membership));
  } catch (error) {
    console.error("[Membership Detail Error]", error);
    return NextResponse.json(
      { error: "获取会员详情失败" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();

    // zod 输入验证
    const result = updateMembershipStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { status } = result.data;

    // 检查会员是否存在
    const existing = await prisma.membership.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "会员不存在" },
        { status: 404 },
      );
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { status },
      include: { parent: true },
    });

    return NextResponse.json(serializeMembership(updated));
  } catch (error) {
    console.error("[Membership Update Error]", error);
    return NextResponse.json(
      { error: "更新会员状态失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    // 检查会员是否存在
    const existing = await prisma.membership.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "会员不存在" },
        { status: 404 },
      );
    }

    await prisma.membership.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Membership Delete Error]", error);
    return NextResponse.json(
      { error: "删除会员失败" },
      { status: 500 },
    );
  }
}

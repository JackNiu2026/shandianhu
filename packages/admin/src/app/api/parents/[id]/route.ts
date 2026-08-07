/**
 * GET   /api/parents/[id] - 获取家长详情（含预约和会员记录）
 * PATCH /api/parents/[id] - 更新家长状态（封禁/解封）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeParent, serializeBooking, serializeMembership } from "@/lib/serialize";
import { updateParentStatusSchema } from "@/lib/validation";

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

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { teacher: true },
          orderBy: { createdAt: "desc" },
        },
        memberships: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "家长不存在" },
        { status: 404 },
      );
    }

    const serialized = serializeParent(parent);

    return NextResponse.json({
      ...serialized,
      bookings: parent.bookings.map((b) => ({
        ...serializeBooking(b),
        teacherName: b.teacher?.name || "",
        teacherSubject: b.teacher?.subject || "",
      })),
      memberships: parent.memberships.map(serializeMembership),
    });
  } catch (error) {
    console.error("[Parent Detail Error]", error);
    return NextResponse.json(
      { error: "获取家长详情失败" },
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
    const result = updateParentStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { status } = result.data;

    // 检查家长是否存在
    const existing = await prisma.parent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "家长不存在" },
        { status: 404 },
      );
    }

    const updated = await prisma.parent.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(serializeParent(updated));
  } catch (error) {
    console.error("[Parent Update Error]", error);
    return NextResponse.json(
      { error: "更新家长状态失败" },
      { status: 500 },
    );
  }
}

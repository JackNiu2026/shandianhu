/**
 * POST /api/public/bookings - 家长端创建预约（使用家长认证）
 * parentId 从认证 token 中提取，防止越权
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { parentBookingSchema } from "@/lib/validation";
import { serializeBooking } from "@/lib/serialize";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    // 安全检查：仅家长可创建预约
    if (auth.role !== "parent") {
      return NextResponse.json(
        { error: "仅家长可创建预约" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = parentBookingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    // parentId 从认证用户中获取，防止越权伪造
    const parentId = auth.username;
    const { teacherId, subject, slot } = result.data;

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return NextResponse.json({ error: "老师不存在" }, { status: 404 });
    }

    // 使用事务保证原子性：创建预约 + 更新计数
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: { parentId, teacherId, subject, slot },
        include: { parent: true, teacher: true },
      });

      await tx.parent.update({
        where: { id: parentId },
        data: { bookingCount: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json(serializeBooking(booking), { status: 201 });
  } catch (error) {
    console.error("[Public Booking Create Error]", error);
    return NextResponse.json(
      { error: "创建预约失败" },
      { status: 500 },
    );
  }
}

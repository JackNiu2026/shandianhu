/**
 * PATCH /api/bookings/[id] - 更新预约状态
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeBooking } from "@/lib/serialize";
import { updateBookingStatusSchema } from "@/lib/validation";

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
    const result = updateBookingStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { status } = result.data;

    // 检查预约是否存在
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "预约不存在" },
        { status: 404 },
      );
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: { parent: true, teacher: true },
    });

    return NextResponse.json(serializeBooking(booking));
  } catch (error) {
    console.error("[Booking Update Error]", error);
    return NextResponse.json(
      { error: "更新预约状态失败" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/bookings - 预约列表（支持 status/teacherId/parentId 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeBooking } from "@/lib/serialize";
import { createBookingSchema, parsePagination } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const teacherId = searchParams.get("teacherId") || "";
    const parentId = searchParams.get("parentId") || "";
    const { skip, take, page, pageSize } = parsePagination(searchParams);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (parentId) {
      where.parentId = parentId;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          parent: true,
          teacher: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    const result = bookings.map(serializeBooking);

    return NextResponse.json({ data: result, total, page, pageSize });
  } catch (error) {
    console.error("[Bookings List Error]", error);
    return NextResponse.json(
      { error: "获取预约列表失败" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/bookings - 创建预约
 */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const result = createBookingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { parentId, teacherId, subject, slot } = result.data;

    // 验证家长和老师存在（并行查询）
    const [parent, teacher] = await Promise.all([
      prisma.parent.findUnique({ where: { id: parentId } }),
      prisma.teacher.findUnique({ where: { id: teacherId } }),
    ]);

    if (!parent) {
      return NextResponse.json({ error: "家长不存在" }, { status: 404 });
    }
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
    console.error("[Booking Create Error]", error);
    return NextResponse.json(
      { error: "创建预约失败" },
      { status: 500 },
    );
  }
}

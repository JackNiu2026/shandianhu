/**
 * GET /api/bookings - 预约列表（支持 status/teacherId/parentId 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeBooking } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const teacherId = searchParams.get("teacherId") || "";
    const parentId = searchParams.get("parentId") || "";

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

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        parent: true,
        teacher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = bookings.map(serializeBooking);

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Bookings List Error]", error);
    return NextResponse.json(
      { error: "获取预约列表失败" },
      { status: 500 },
    );
  }
}

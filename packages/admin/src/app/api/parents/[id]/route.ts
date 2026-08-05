/**
 * GET /api/parents/[id] - 获取家长详情（含预约和会员记录）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeParent, serializeBooking, serializeMembership } from "@/lib/serialize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

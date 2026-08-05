/**
 * GET /api/memberships - 会员列表（支持 status 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMembership } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const memberships = await prisma.membership.findMany({
      where,
      include: { parent: true },
      orderBy: { createdAt: "desc" },
    });

    const result = memberships.map(serializeMembership);

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Memberships List Error]", error);
    return NextResponse.json(
      { error: "获取会员列表失败" },
      { status: 500 },
    );
  }
}

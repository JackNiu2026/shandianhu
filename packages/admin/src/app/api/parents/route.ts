/**
 * GET /api/parents - 家长列表（支持 search/status 查询参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeParent } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const parents = await prisma.parent.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const result = parents.map(serializeParent);

    return NextResponse.json({ data: result, total: result.length });
  } catch (error) {
    console.error("[Parents List Error]", error);
    return NextResponse.json(
      { error: "获取家长列表失败" },
      { status: 500 },
    );
  }
}

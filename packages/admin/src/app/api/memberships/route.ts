/**
 * GET  /api/memberships - 会员列表（支持 status 查询参数）
 * POST /api/memberships - 创建会员
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { serializeMembership } from "@/lib/serialize";
import { createMembershipSchema, parsePagination } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const { skip, take, page, pageSize } = parsePagination(searchParams);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        include: { parent: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.membership.count({ where }),
    ]);

    const result = memberships.map(serializeMembership);

    return NextResponse.json({ data: result, total, page, pageSize });
  } catch (error) {
    console.error("[Memberships List Error]", error);
    return NextResponse.json(
      { error: "获取会员列表失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    // zod 输入验证
    const result = createMembershipSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const data = result.data;

    // 检查家长是否存在
    const parent = await prisma.parent.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      return NextResponse.json(
        { error: "家长不存在" },
        { status: 404 },
      );
    }

    const membership = await prisma.membership.create({
      data: {
        parentId: data.parentId,
        duration: data.duration,
        amount: data.amount,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
      },
      include: { parent: true },
    });

    return NextResponse.json(serializeMembership(membership), { status: 201 });
  } catch (error) {
    console.error("[Membership Create Error]", error);
    return NextResponse.json(
      { error: "创建会员失败" },
      { status: 500 },
    );
  }
}

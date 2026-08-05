/**
 * GET   /api/finance/withdrawals - 提现列表（支持 status 查询参数）
 * PATCH /api/finance/withdrawals - 处理提现（通过 id 参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeWithdrawal } from "@/lib/serialize";
import { updateWithdrawalSchema, parsePagination } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const { skip, take, page, pageSize } = parsePagination(searchParams);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: { teacher: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.withdrawal.count({ where }),
    ]);

    const result = withdrawals.map(serializeWithdrawal);

    return NextResponse.json({ data: result, total, page, pageSize });
  } catch (error) {
    console.error("[Withdrawals List Error]", error);
    return NextResponse.json(
      { error: "获取提现列表失败" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // 验证认证
    const auth = authenticateRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    // zod 输入验证
    const result = updateWithdrawalSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { id, status } = result.data;

    // 检查提现记录是否存在
    const existing = await prisma.withdrawal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "提现记录不存在" },
        { status: 404 },
      );
    }

    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: { status },
      include: { teacher: true },
    });

    return NextResponse.json(serializeWithdrawal(withdrawal));
  } catch (error) {
    console.error("[Withdrawal Update Error]", error);
    return NextResponse.json(
      { error: "处理提现失败" },
      { status: 500 },
    );
  }
}

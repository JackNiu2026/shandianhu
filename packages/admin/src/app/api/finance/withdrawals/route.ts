/**
 * GET   /api/finance/withdrawals - 提现列表（支持 status 查询参数）
 * PATCH /api/finance/withdrawals - 处理提现（通过 id 参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeWithdrawal } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const result = withdrawals.map(serializeWithdrawal);

    return NextResponse.json({ data: result, total: result.length });
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
    const { id, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "缺少提现记录 ID" },
        { status: 400 },
      );
    }

    // 验证 status 值
    const validStatuses = ["pending", "processed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "无效的提现状态" },
        { status: 400 },
      );
    }

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

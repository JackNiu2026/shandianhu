/**
 * GET /api/finance/stats - 财务统计数据
 * 使用数据库聚合查询，避免全表加载到内存
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    // 使用数据库聚合查询，避免全表加载
    const [
      teacherAgg,
      pendingWithdrawalAgg,
      totalWithdrawalAgg,
      processedWithdrawalCount,
      pendingWithdrawalCount,
      membershipAgg,
    ] = await Promise.all([
      prisma.teacher.aggregate({
        _sum: {
          totalRevenue: true,
          pendingRevenue: true,
          availableRevenue: true,
          totalLessons: true,
        },
      }),
      prisma.withdrawal.aggregate({
        where: { status: "pending" },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        _sum: { amount: true },
      }),
      prisma.withdrawal.count({ where: { status: "processed" } }),
      prisma.withdrawal.count({ where: { status: "pending" } }),
      prisma.membership.aggregate({
        where: { status: "active" },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      revenue: {
        total: teacherAgg._sum.totalRevenue || 0,
        pending: teacherAgg._sum.pendingRevenue || 0,
        available: teacherAgg._sum.availableRevenue || 0,
        membership: membershipAgg._sum.amount || 0,
      },
      withdrawals: {
        total: totalWithdrawalAgg._sum.amount || 0,
        pending: pendingWithdrawalAgg._sum.amount || 0,
        pendingCount: pendingWithdrawalCount,
        processedCount: processedWithdrawalCount,
      },
      lessons: {
        total: teacherAgg._sum.totalLessons || 0,
      },
    });
  } catch (error) {
    console.error("[Finance Stats Error]", error);
    return NextResponse.json(
      { error: "获取财务统计失败" },
      { status: 500 },
    );
  }
}

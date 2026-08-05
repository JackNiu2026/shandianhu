/**
 * GET /api/finance/stats - 财务统计数据
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 获取所有老师收入数据
    const teachers = await prisma.teacher.findMany({
      select: {
        totalRevenue: true,
        pendingRevenue: true,
        availableRevenue: true,
        totalLessons: true,
      },
    });

    const totalRevenue = teachers.reduce((sum, t) => sum + t.totalRevenue, 0);
    const pendingRevenue = teachers.reduce((sum, t) => sum + t.pendingRevenue, 0);
    const availableRevenue = teachers.reduce((sum, t) => sum + t.availableRevenue, 0);
    const totalLessons = teachers.reduce((sum, t) => sum + t.totalLessons, 0);

    // 提现统计
    const withdrawals = await prisma.withdrawal.findMany();
    const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
    const processedWithdrawals = withdrawals.filter((w) => w.status === "processed");
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    // 会员收入统计
    const memberships = await prisma.membership.findMany({
      where: { status: "active" },
    });
    const membershipRevenue = memberships.reduce((sum, m) => sum + m.amount, 0);

    return NextResponse.json({
      revenue: {
        total: totalRevenue,
        pending: pendingRevenue,
        available: availableRevenue,
        membership: membershipRevenue,
      },
      withdrawals: {
        total: totalWithdrawalAmount,
        pending: pendingWithdrawalAmount,
        pendingCount: pendingWithdrawals.length,
        processedCount: processedWithdrawals.length,
      },
      lessons: {
        total: totalLessons,
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

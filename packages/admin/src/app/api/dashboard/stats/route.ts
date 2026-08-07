/**
 * GET /api/dashboard/stats - 仪表盘统计数据
 * 使用数据库聚合查询 + groupBy，避免全表加载到内存
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { subjects } from "@lightning-tiger/shared";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    // 并行查询各项统计数据（使用聚合和 groupBy）
    const [
      teacherCount,
      parentCount,
      bookingCount,
      pendingReviews,
      pendingBookings,
      pendingTeachers,
      activeMemberships,
      teacherRevenueAgg,
      subjectGroup,
      ratingGroup,
      reviewStatusGroup,
      bookingStatusGroup,
      gradeGroup,
      parentMbti,
    ] = await Promise.all([
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.booking.count(),
      prisma.review.count({ where: { status: "pending" } }),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.teacher.count({ where: { status: "pending" } }),
      prisma.membership.count({ where: { status: "active" } }),
      prisma.teacher.aggregate({ _sum: { totalRevenue: true } }),
      prisma.teacher.groupBy({ by: ["subject"], _count: true }),
      prisma.teacher.groupBy({ by: ["rating"], _count: true }),
      prisma.review.groupBy({ by: ["status"], _count: true }),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
      prisma.parent.groupBy({ by: ["childGrade"], _count: true }),
      prisma.parent.findMany({
        where: { NOT: { mbtiResult: null } },
        select: { mbtiResult: true },
      }),
    ]);

    const totalRevenue = teacherRevenueAgg._sum.totalRevenue || 0;

    // 科目分布（使用 shared 包的 subjects 列表）
    const subjectDist = subjects.map((s) => ({
      name: s,
      count: subjectGroup.find((g) => g.subject === s)?._count || 0,
    }));

    // 评分分布
    const ratingDist = ["4.9", "4.8", "4.7", "4.6", "4.5"].map((r) => ({
      name: r,
      count: ratingGroup.find((g) => g.rating === r)?._count || 0,
    }));

    // 评价状态分布
    const reviewStats = {
      approved: reviewStatusGroup.find((g) => g.status === "approved")?._count || 0,
      pending: reviewStatusGroup.find((g) => g.status === "pending")?._count || 0,
      rejected: reviewStatusGroup.find((g) => g.status === "rejected")?._count || 0,
    };

    // 预约状态分布
    const bookingStats = {
      completed: bookingStatusGroup.find((g) => g.status === "completed")?._count || 0,
      confirmed: bookingStatusGroup.find((g) => g.status === "confirmed")?._count || 0,
      pending: bookingStatusGroup.find((g) => g.status === "pending")?._count || 0,
      cancelled: bookingStatusGroup.find((g) => g.status === "cancelled")?._count || 0,
    };

    // 学段分布
    const gradeDist = ["小学", "初中", "高中"].map((g) => ({
      name: g,
      count: gradeGroup.find((p) => p.childGrade === g)?._count || 0,
    }));

    // MBTI 维度分布（P1-2：mbtiResult 已是 Json 对象，无需 parse）
    const mbtiResults = parentMbti
      .map((p) => (p.mbtiResult as { code: string } | null)?.code ?? null)
      .filter((c): c is string => c !== null);

    const mbtiDimensionStats = [
      { dim: "EI", E: mbtiResults.filter((c) => c.includes("E")).length, I: mbtiResults.filter((c) => c.includes("I")).length },
      { dim: "SN", S: mbtiResults.filter((c) => c.includes("S")).length, N: mbtiResults.filter((c) => c.includes("N")).length },
      { dim: "TF", T: mbtiResults.filter((c) => c.includes("T")).length, F: mbtiResults.filter((c) => c.includes("F")).length },
      { dim: "JP", J: mbtiResults.filter((c) => c.includes("J")).length, P: mbtiResults.filter((c) => c.includes("P")).length },
    ];

    return NextResponse.json({
      teacherCount,
      parentCount,
      bookingCount,
      totalRevenue,
      pendingReviews,
      pendingBookings,
      pendingTeachers,
      activeMemberships,
      subjectDistribution: subjectDist,
      ratingDistribution: ratingDist,
      reviewStats,
      bookingStats,
      gradeDistribution: gradeDist,
      mbtiDimensionStats,
    });
  } catch (error) {
    console.error("[Dashboard Stats Error]", error);
    return NextResponse.json(
      { error: "获取仪表盘统计失败" },
      { status: 500 },
    );
  }
}

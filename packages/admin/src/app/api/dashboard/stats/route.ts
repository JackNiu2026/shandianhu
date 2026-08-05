/**
 * GET /api/dashboard/stats - 仪表盘统计数据
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 并行查询各项统计数据
    const [
      teacherCount,
      parentCount,
      bookingCount,
      pendingReviews,
      pendingBookings,
      pendingTeachers,
      activeMemberships,
      teachers,
      reviews,
      bookings,
      parents,
    ] = await Promise.all([
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.booking.count(),
      prisma.review.count({ where: { status: "pending" } }),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.teacher.count({ where: { status: "pending" } }),
      prisma.membership.count({ where: { status: "active" } }),
      prisma.teacher.findMany({
        select: { totalRevenue: true, subject: true, rating: true },
      }),
      prisma.review.findMany({
        select: { status: true, rating: true },
      }),
      prisma.booking.findMany({
        select: { status: true, createdAt: true },
      }),
      prisma.parent.findMany({
        select: { childGrade: true, mbtiResult: true },
      }),
    ]);

    // 计算总收益
    const totalRevenue = teachers.reduce((sum, t) => sum + t.totalRevenue, 0);

    // 科目分布
    const subjectDistribution = ["语文", "数学", "英语", "物理", "化学"].map((s) => ({
      name: s,
      count: teachers.filter((t) => t.subject === s).length,
    }));

    // 评分分布
    const ratingDistribution = ["4.9", "4.8", "4.7", "4.6", "4.5"].map((r) => ({
      name: r,
      count: teachers.filter((t) => t.rating === r).length,
    }));

    // 评价状态分布
    const reviewStats = {
      approved: reviews.filter((r) => r.status === "approved").length,
      pending: reviews.filter((r) => r.status === "pending").length,
      rejected: reviews.filter((r) => r.status === "rejected").length,
    };

    // 预约状态分布
    const bookingStats = {
      completed: bookings.filter((b) => b.status === "completed").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      pending: bookings.filter((b) => b.status === "pending").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    // 学段分布
    const gradeDistribution = ["小学", "初中", "高中"].map((g) => ({
      name: g,
      count: parents.filter((p) => p.childGrade === g).length,
    }));

    // MBTI 维度分布
    const mbtiResults = parents
      .filter((p) => p.mbtiResult)
      .map((p) => JSON.parse(p.mbtiResult!).code as string);

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
      subjectDistribution,
      ratingDistribution,
      reviewStats,
      bookingStats,
      gradeDistribution,
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

/**
 * V2.3 家长查看老师详情
 *
 * - GET /api/v2/tutors/[id]   获取老师公开资料 + 最近评价 + 时段预览
 *
 * 仅返回 TeacherProfileSummary 字段及 recentReviews、availabilityPreview，
 * 不返回 legalName、fileObjectId 等私有字段。家长无需指定 workspace 即可查看。
 */
import { AppError, ReviewService, SlotService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/prisma";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const reviewService = new ReviewService();
const slotService = new SlotService();

const RECENT_REVIEWS_LIMIT = 5;
const AVAILABILITY_PREVIEW_DAYS = 14;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }] = await Promise.all([params]);
    // 详情页是公开资料，但仍需登录态以避免匿名爬取
    await authenticatedUserId(request);

    const profile = await prisma.teacherProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Teacher profile not found");
    }
    if (profile.serviceStatus !== "ACTIVE") {
      throw new AppError("NOT_FOUND", 404, "Teacher profile not found");
    }

    // 评价聚合
    const aggregate = await prisma.parentReview.aggregate({
      where: { teacherProfileId: id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // 最近评价
    const recentReviews = await reviewService.listByTeacher(id, RECENT_REVIEWS_LIMIT);

    // 时段预览：未来 14 天
    const now = new Date();
    const startDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    const endDate = new Date(now.getTime() + AVAILABILITY_PREVIEW_DAYS * 24 * 60 * 60 * 1000);
    const endDateStr = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
    const availabilityPreview = await slotService.listRange(
      id,
      startDate,
      endDateStr,
      "Asia/Shanghai",
    );

    return {
      teacher: {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        subjects: profile.subjects,
        schoolStages: profile.schoolStages,
        teachingModes: profile.teachingModes,
        serviceAreaCodes: profile.serviceAreaCodes,
        teachingTags: profile.teachingTags,
        experienceYears: profile.experienceYears,
        pricePerHour: profile.pricePerHour,
        serviceStatus: profile.serviceStatus,
        avgRating: aggregate._avg.rating,
        reviewCount: aggregate._count.rating,
      },
      recentReviews,
      availabilityPreview: availabilityPreview.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        weekday: s.weekday,
      })),
    };
  });
}

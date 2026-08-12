/**
 * V2.3 家长自主浏览老师列表
 *
 * - GET /api/v2/tutors   按科目、学段筛选 ACTIVE 老师（绕过软评分，保留硬条件）
 *
 * 返回 TeacherProfileSummary 列表，按创建顺序排序。包含 avgRating 与 reviewCount
 * 以便前端展示。不返回 legalName、fileObjectId 等敏感字段。
 */
import {
  AppError,
  RecommendationService,
  resolveRoleContext,
} from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const recommendationService = new RecommendationService();

const querySchema = z.object({
  subject: z.enum([
    "CHINESE",
    "MATH",
    "ENGLISH",
    "PHYSICS",
    "CHEMISTRY",
  ]),
  schoolStage: z.enum(["PRIMARY", "MIDDLE", "HIGH"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    // 家长工作区校验（自主浏览仍需家长身份）
    await resolveRoleContext({ userId }, "parent");
    const params = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!params.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid tutors query");
    }
    const tutors = await recommendationService.listAll({
      subject: params.data.subject,
      schoolStage: params.data.schoolStage,
      limit: params.data.limit,
    });
    return { tutors };
  });
}

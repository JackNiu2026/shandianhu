/**
 * V2.3 家长推荐老师
 *
 * - POST /api/v2/tutors/recommendations   为指定孩子生成画像推荐
 *
 * 输入 RecommendationRequest，输出 RecommendationResult。
 * 推荐结果可复算：相同输入产生相同排序。不向家长暴露 MBTI、心理诊断等敏感画像字段。
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

const requestSchema = z
  .object({
    childId: z.string().min(1),
    subject: z.enum([
      "CHINESE",
      "MATH",
      "ENGLISH",
      "PHYSICS",
      "CHEMISTRY",
    ]),
    preferredMode: z.enum(["ONLINE", "IN_HOME", "IN_CENTER"]).optional(),
    budgetMaxPerHour: z.number().int().positive().max(100000).optional(),
    minExperienceYears: z.number().int().min(0).max(80).optional(),
    preferredStartsAt: z.string().datetime().optional(),
    preferredEndsAt: z.string().datetime().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "parent");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid recommendation request");
    }
    const result = await recommendationService.recommend({
      parentProfileId: ctx.parentProfileId!,
      childId: parsed.data.childId,
      subject: parsed.data.subject,
      preferredMode: parsed.data.preferredMode,
      budgetMaxPerHour: parsed.data.budgetMaxPerHour,
      minExperienceYears: parsed.data.minExperienceYears,
      preferredStartsAt: parsed.data.preferredStartsAt,
      preferredEndsAt: parsed.data.preferredEndsAt,
    });
    return { result };
  });
}

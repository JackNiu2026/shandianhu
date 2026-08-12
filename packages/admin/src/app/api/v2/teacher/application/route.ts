/**
 * V2.3 老师申请：获取或创建草稿 / 更新草稿
 *
 * - GET  /api/v2/teacher/application         获取当前用户的草稿申请（不存在则创建空草稿）
 * - POST /api/v2/teacher/application         更新草稿（DRAFT 或 NEEDS_MORE_INFO 状态可编辑）
 */
import { AppError, ApplicationService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const applicationService = new ApplicationService();

// 草稿字段校验：所有字段可选，按需更新
const draftSchema = z
  .object({
    legalName: z.string().trim().max(80).optional(),
    education: z.string().trim().max(200).optional(),
    experienceYears: z.number().int().min(0).max(80).optional(),
    pricePerHour: z.number().int().positive().max(100000).optional(),
    bio: z.string().max(2000).optional(),
    teachingModes: z.array(z.enum(["ONLINE", "IN_HOME", "IN_CENTER"])).max(5).optional(),
    serviceAreaCode: z.string().trim().max(40).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const application = await applicationService.getOrCreateDraft({ userId });
    return { application };
  });
}

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = draftSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid application draft");
    }
    // 先确保存在草稿，再以草稿 id 更新
    const draft = await applicationService.getOrCreateDraft({ userId });
    const application = await applicationService.updateDraft(draft.id, userId, parsed.data);
    return { application };
  });
}

/**
 * V2.3 老师课程反馈：提交 / 查看
 *
 * - GET  /api/v2/teacher/lessons/[id]/feedback   查看当前课程的反馈（老师视角，含私有备注）
 * - POST /api/v2/teacher/lessons/[id]/feedback   提交或修订反馈
 *
 * 反馈为版本化记录：首次提交 sequence=1，修订必须提供 correctionReason，
 * 旧版本 isCurrent=false。公开字段写 LearningEvidence，privateTeacherNote 不进入画像。
 */
import {
  AppError,
  FeedbackService,
  teacherFeedbackSchema,
  resolveRoleContext,
} from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const feedbackService = new FeedbackService();

// 提交反馈的入参：operationKey 用于幂等，correctionReason 修订时必填
const submitSchema = z
  .object({
    operationKey: z.string().trim().min(1).max(128),
    correctionReason: z.string().trim().max(500).optional(),
    feedback: teacherFeedbackSchema,
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    // 老师视角查看完整反馈（含 privateTeacherNote）
    const feedback = await feedbackService.getByLesson(id, ctx.teacherProfileId!);
    return { feedback };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid feedback payload");
    }
    const feedback = await feedbackService.submit(
      ctx.teacherProfileId!,
      id,
      parsed.data.operationKey,
      parsed.data.feedback,
      parsed.data.correctionReason,
    );
    return { feedback };
  });
}

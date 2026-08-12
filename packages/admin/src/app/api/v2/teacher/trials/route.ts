/**
 * V2.3 老师试听列表
 *
 * - GET /api/v2/teacher/trials   获取分配给当前老师的试听列表（按 createdAt 倒序）
 *
 * 支持可选 status 过滤。返回的 teacherDisplayName 由服务层填充。
 */
import { TrialService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const trialService = new TrialService();

const querySchema = z.object({
  status: z
    .enum([
      "REQUESTED",
      "ACCEPTED",
      "RESCHEDULE_PROPOSED",
      "REJECTED",
      "PARENT_CONFIRMED",
      "READY",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
});

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const params = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const status = params.success ? params.data.status : undefined;
    const trials = await trialService.listByTeacher(ctx.teacherProfileId!, status);
    return { trials };
  });
}

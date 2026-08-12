/**
 * V2.3 老师申请：提交申请
 *
 * - POST /api/v2/teacher/application/submit   提交草稿进入审核队列
 *
 * 校验必填字段与必需资质（IDENTITY + EDUCATION），状态由 DRAFT/NEEDS_MORE_INFO
 * 切换为 SUBMITTED。
 */
import { ApplicationService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const applicationService = new ApplicationService();

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    // 获取当前用户的草稿申请并提交
    const draft = await applicationService.getOrCreateDraft({ userId });
    const application = await applicationService.submit(draft.id, userId);
    return { application };
  });
}

/**
 * V2.3 试听详情（含变更历史时间线）
 *
 * - GET /api/v2/trials/[id]   获取试听详情
 *
 * 权限：仅该试听的家长或老师可查看。TrialService.getById 内部校验 viewerId
 * 归属权（parentProfileId 或 teacherProfileId 之一必须匹配）。
 */
import { AppError, TrialService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const trialService = new TrialService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    // 尝试以家长身份解析；若家长身份不成立，尝试以老师身份解析
    let viewerId: string;
    try {
      const ctx = await resolveRoleContext({ userId }, "parent");
      viewerId = ctx.parentProfileId!;
    } catch {
      const ctx = await resolveRoleContext({ userId }, "teacher");
      viewerId = ctx.teacherProfileId!;
    }
    const trial = await trialService.getById(id, viewerId);
    return { trial };
  });
}

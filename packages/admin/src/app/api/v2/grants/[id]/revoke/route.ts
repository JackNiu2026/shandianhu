/**
 * V2.3 家长撤销数据授权
 *
 * - POST /api/v2/grants/[id]/revoke   撤销指定 DataGrant，立即生效
 *
 * 安全约束：
 * - 仅家长工作区可调用
 * - GrantService 内部校验 grant 归属权（parentProfileId 必须匹配）
 * - 已撤销的 grant 返回 409 RESOURCE_CONFLICT
 */
import { AppError, GrantService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const grantService = new GrantService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    // 校验当前会话为家长工作区并取得 parentProfileId
    const ctx = await resolveRoleContext({ userId }, "parent");
    if (!ctx.parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "Parent workspace required");
    }
    const grant = await grantService.revoke(ctx.parentProfileId, id);
    return { grant };
  });
}

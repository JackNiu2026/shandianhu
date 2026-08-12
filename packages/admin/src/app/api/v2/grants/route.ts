/**
 * V2.3 家长查看自己发出的数据授权列表
 *
 * - GET /api/v2/grants   列出当前家长的所有 DataGrant（按创建时间倒序）
 *
 * 安全约束：仅家长工作区可调用，只返回属于当前 parentProfileId 的授权记录。
 */
import { AppError, GrantService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const grantService = new GrantService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    // 校验当前会话为家长工作区并取得 parentProfileId
    const ctx = await resolveRoleContext({ userId }, "parent");
    if (!ctx.parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "Parent workspace required");
    }
    const grants = await grantService.listByParent(ctx.parentProfileId);
    return { grants };
  });
}

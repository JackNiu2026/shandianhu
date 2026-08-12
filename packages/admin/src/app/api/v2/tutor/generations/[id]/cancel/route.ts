import { defaultCancellationRegistry } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

/**
 * POST /api/v2/tutor/generations/[id]/cancel
 * 客户端或运营后台停止一次正在进行中的流式生成。
 *
 * 注意：
 * - 取消是尽力而为（best-effort）标记；如果生成已进入最后 done/error 事件，返回 ok=true 且 no-op
 * - 权限：可以是学生家长（tutor 端）或 admin（运营后台），当前走 admin 侧校验
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    // 这里调用 admin 校验；tutor 端应做家长身份校验并限制只可操作自己的会话
    // 实际多端可抽象出 shared helper。此路由位于 admin/api 子目录，因此只允许 admin
    await requireAdmin(_request);
    const { id: generationId } = await params;
    const ok = defaultCancellationRegistry.cancel(generationId);
    return {
      cancelled: ok,
      generationId,
      message: ok ? "Cancel signal accepted" : "Generation not found (may have already finished)",
    };
  });
}

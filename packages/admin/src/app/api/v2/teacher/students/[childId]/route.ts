/**
 * V2.3 老师读取学生摘要（最小范围）
 *
 * - GET /api/v2/teacher/students/[childId]   读取该孩子的最小范围学习摘要
 *
 * 同时校验：老师 ACTIVE + 有效服务关系 + grant 未撤销未过期 + 包含 LEARNING_NEEDS scope。
 * 返回 DTO 严格排除家长手机号、原始错题、AI 对话原文、MBTI、学校名称等敏感字段。
 */
import { GrantService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const grantService = new GrantService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  return toHttpResponse(async () => {
    const [{ childId }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const summary = await grantService.readStudentSummary(
      ctx.teacherProfileId!,
      childId,
    );
    return { summary };
  });
}

/**
 * V2.3 老师工作台聚合数据
 *
 * - GET /api/v2/teacher/dashboard   获取老师工作台待办聚合
 *
 * 聚合内容：
 * - pendingTrials：REQUESTED + ACCEPTED + RESCHEDULE_PROPOSED，按 createdAt 升序
 * - upcomingLessons：SCHEDULED + IN_PROGRESS，按 startsAt 升序，最多 10 条
 * - lessonsAwaitingFeedback：COMPLETED 但无 current feedback 的课程
 * - activeStudents：有未来课程的孩子，按 childId 去重
 */
import { DashboardService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const dashboardService = new DashboardService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const dashboard = await dashboardService.load(ctx.teacherProfileId!);
    return { dashboard };
  });
}

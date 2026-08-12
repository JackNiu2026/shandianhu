/**
 * V2.3 老师学生列表
 *
 * - GET /api/v2/teacher/students   获取当前老师有有效服务关系的学生列表
 *
 * 有效服务关系 = 有未完成 Lesson（SCHEDULED/IN_PROGRESS）或最近 COMPLETED TrialBooking。
 */
import { GrantService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const grantService = new GrantService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const students = await grantService.listStudents(ctx.teacherProfileId!);
    return { students };
  });
}

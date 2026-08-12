/**
 * V2.3 老师可授课时间：周期规则查询与批量替换
 *
 * - GET  /api/v2/teacher/availability          获取该老师的全部周期规则（按 weekday 升序）
 * - PUT  /api/v2/teacher/availability          替换该老师的全部周期规则
 *
 * 通过 resolveRoleContext(workspace=teacher) 解析当前老师的 teacherProfileId，
 * 不信任 header 自报角色。
 */
import { AppError, AvailabilityService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const availabilityService = new AvailabilityService();

// 周期规则输入校验：weekday 1-7，分钟 0-1440，单段 30-240 分钟
const ruleSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const setWeeklySchema = z.object({
  rules: z.array(ruleSchema).max(100),
});

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    // 校验当前会话为老师工作区并取得 teacherProfileId
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const rules = await availabilityService.getWeekly(ctx.teacherProfileId!);
    return { rules };
  });
}

export async function PUT(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = setWeeklySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid weekly availability rules");
    }
    // AvailabilityService 内部会做单条与重叠校验
    await availabilityService.setWeekly(ctx.teacherProfileId!, parsed.data.rules);
    const rules = await availabilityService.getWeekly(ctx.teacherProfileId!);
    return { rules };
  });
}

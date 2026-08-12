/**
 * V2.3 老师可授课时间：日期例外查询与设置
 *
 * - GET  /api/v2/teacher/availability/exceptions   获取该老师的全部例外（按 date 升序）
 * - POST /api/v2/teacher/availability/exceptions   设置或替换某天的例外
 *
 * 例外优先于周期规则：
 * - UNAVAILABLE 整天（startMinute=null）：移除该日所有周期投影
 * - UNAVAILABLE 带具体时段：移除该日与例外时段重叠的投影
 * - AVAILABLE 带具体时段：在该日追加例外时段
 */
import { AppError, AvailabilityService, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const availabilityService = new AvailabilityService();

// 例外输入校验：date YYYY-MM-DD，type AVAILABLE/UNAVAILABLE，
// UNAVAILABLE 可省略 startMinute/endMinute 表示全天
const exceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    type: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    startMinute: z.number().int().min(0).max(1440).nullable().optional(),
    endMinute: z.number().int().min(0).max(1440).nullable().optional(),
    reason: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const exceptions = await availabilityService.getExceptions(ctx.teacherProfileId!);
    return { exceptions };
  });
}

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = exceptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid availability exception");
    }
    const exception = await availabilityService.setException(
      ctx.teacherProfileId!,
      parsed.data.date,
      parsed.data.type,
      parsed.data.startMinute ?? null,
      parsed.data.endMinute ?? null,
      parsed.data.reason ?? null,
    );
    return { exception };
  });
}

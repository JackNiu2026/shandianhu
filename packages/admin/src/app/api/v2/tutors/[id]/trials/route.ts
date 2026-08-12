/**
 * V2.3 家长为指定老师发起试听 / 查询试听历史
 *
 * - GET  /api/v2/tutors/[id]/trials   获取当前家长与该老师的试听列表
 * - POST /api/v2/tutors/[id]/trials   发起试听申请
 *
 * 创建试听：
 * - 校验家长拥有 childId
 * - 校验老师 ACTIVE
 * - 校验时段在未来且在老师可用时间内
 * - 幂等：(parentProfileId, idempotencyKey) 唯一
 * - 创建 TrialBooking(REQUESTED) + BookingChange，通知老师
 */
import {
  AppError,
  TrialService,
  resolveRoleContext,
} from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const trialService = new TrialService();

const createSchema = z
  .object({
    childId: z.string().min(1),
    subject: z.enum([
      "CHINESE",
      "MATH",
      "ENGLISH",
      "PHYSICS",
      "CHEMISTRY",
    ]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    idempotencyKey: z.string().min(1).max(128),
    mode: z.enum(["ONLINE", "IN_HOME", "IN_CENTER"]).optional(),
    parentNote: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "parent");
    const trials = await trialService.listByParent(ctx.parentProfileId!, undefined);
    // 仅返回与该老师的试听
    const filtered = trials.filter((t) => t.teacherProfileId === id);
    return { trials: filtered };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "parent");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid trial booking request");
    }
    const trial = await trialService.create({
      parentProfileId: ctx.parentProfileId!,
      childId: parsed.data.childId,
      teacherProfileId: id,
      subject: parsed.data.subject,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      idempotencyKey: parsed.data.idempotencyKey,
      mode: parsed.data.mode,
      parentNote: parsed.data.parentNote,
    });
    return { trial };
  });
}

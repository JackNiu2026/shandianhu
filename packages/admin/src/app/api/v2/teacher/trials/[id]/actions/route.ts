/**
 * V2.3 老师对试听执行动作
 *
 * - POST /api/v2/teacher/trials/[id]/actions
 *
 * Body: { action, version, ... }
 * action 取值：ACCEPT | REJECT | PROPOSE_RESCHEDULE | MARK_READY | COMPLETE | CANCEL
 * 依据状态机执行转换，全部走 TrialService 的乐观锁路径。
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

const actionSchema = z
  .object({
    action: z.enum([
      "ACCEPT",
      "REJECT",
      "PROPOSE_RESCHEDULE",
      "MARK_READY",
      "COMPLETE",
      "CANCEL",
    ]),
    version: z.number().int().min(0),
    reason: z.string().trim().max(500).optional(),
    proposedStartsAt: z.string().datetime().optional(),
    proposedEndsAt: z.string().datetime().optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid trial action payload");
    }
    const a = parsed.data;
    switch (a.action) {
      case "ACCEPT":
        return {
          trial: await trialService.accept(ctx.teacherProfileId!, id, a.version),
        };
      case "REJECT":
        return {
          trial: await trialService.reject(
            ctx.teacherProfileId!,
            id,
            a.version,
            a.reason,
          ),
        };
      case "PROPOSE_RESCHEDULE": {
        if (!a.proposedStartsAt || !a.proposedEndsAt) {
          throw new AppError(
            "VALIDATION_ERROR",
            400,
            "proposedStartsAt and proposedEndsAt are required for PROPOSE_RESCHEDULE",
          );
        }
        return {
          trial: await trialService.proposeReschedule(
            ctx.teacherProfileId!,
            id,
            a.version,
            new Date(a.proposedStartsAt),
            new Date(a.proposedEndsAt),
            a.reason,
          ),
        };
      }
      case "MARK_READY":
        return {
          trial: await trialService.markReady(ctx.teacherProfileId!, id, a.version),
        };
      case "COMPLETE":
        return {
          trial: await trialService.complete(ctx.teacherProfileId!, id, a.version),
        };
      case "CANCEL":
        return {
          trial: await trialService.cancel(
            { kind: "TEACHER", id: ctx.teacherProfileId! },
            id,
            a.version,
            a.reason,
          ),
        };
      default:
        throw new AppError("VALIDATION_ERROR", 400, `Unsupported action: ${a.action}`);
    }
  });
}

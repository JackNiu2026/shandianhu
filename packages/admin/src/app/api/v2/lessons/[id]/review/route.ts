/**
 * V2.3 家长课程评价：提交 / 查看
 *
 * - GET  /api/v2/lessons/[id]/review   查看该课程的评价
 * - POST /api/v2/lessons/[id]/review   家长为已完成课程提交评价
 *
 * 评价必须绑定真实已完成课程（lesson.status=COMPLETED）。
 * 校验 lesson 属于该家长的 child。唯一性：每个 lesson 只有一个 review。
 * author 从会话和课程关系推导（脱敏称呼），不由 client 传入。
 */
import {
  AppError,
  ReviewService,
  resolveRoleContext,
} from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const reviewService = new ReviewService();

const createSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().min(10).max(1000),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    // 家长工作区校验
    await resolveRoleContext({ userId }, "parent");
    const review = await reviewService.getByLesson(id);
    return { review };
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
      throw new AppError("VALIDATION_ERROR", 400, "Invalid review payload");
    }
    const review = await reviewService.create(ctx.parentProfileId!, id, parsed.data);
    return { review };
  });
}

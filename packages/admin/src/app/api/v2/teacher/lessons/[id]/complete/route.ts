/**
 * V2.3 老师标记课程完成
 *
 * - POST /api/v2/teacher/lessons/[id]/complete   把课程状态推进到 COMPLETED
 *
 * 仅允许该课程所属老师操作。从 SCHEDULED 或 IN_PROGRESS 推进到 COMPLETED，
 * 写入 completedAt。READY 状态的试听课程应通过试听状态机 COMPLETE 事件完成，
 * 不应直接调用本接口。
 */
import { AppError, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/prisma";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const COMPLETABLE_STATUSES = ["SCHEDULED", "IN_PROGRESS"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      throw new AppError("NOT_FOUND", 404, "Lesson not found");
    }
    if (lesson.teacherProfileId !== ctx.teacherProfileId) {
      throw new AppError("FORBIDDEN", 403, "Only the assigned teacher can complete this lesson");
    }
    if (!COMPLETABLE_STATUSES.includes(lesson.status)) {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        `Cannot complete lesson in ${lesson.status} status`,
      );
    }
    const updated = await prisma.lesson.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return {
      lesson: {
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      },
    };
  });
}

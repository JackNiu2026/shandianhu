/**
 * V2.3 老师课程列表
 *
 * - GET /api/v2/teacher/lessons   获取分配给当前老师的课程列表（按 startsAt 升序）
 *
 * 支持可选 status 过滤。课程记录由 TrialService.parentConfirm 创建（来源试听）
 * 或后续由排期系统独立创建。当前仅暴露查询能力，写操作由试听状态机驱动。
 */
import { AppError, resolveRoleContext } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const querySchema = z.object({
  status: z
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
});

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "teacher");
    const params = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const status = params.success ? params.data.status : undefined;
    const lessons = await prisma.lesson.findMany({
      where: { teacherProfileId: ctx.teacherProfileId!, ...(status ? { status } : {}) },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
    return {
      lessons: lessons.map((l) => ({
        id: l.id,
        childId: l.childId,
        teacherProfileId: l.teacherProfileId,
        subject: l.subject,
        startsAt: l.startsAt.toISOString(),
        endsAt: l.endsAt.toISOString(),
        status: l.status,
        mode: l.mode,
        completedAt: l.completedAt ? l.completedAt.toISOString() : null,
      })),
    };
  });
}

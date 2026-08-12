import type { NextRequest } from "next/server";
import { resolveRoleContext } from "@lightning-tiger/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "parent");
    const children = await prisma.child.findMany({ where: { parentProfileId: ctx.parentProfileId!, deletedAt: null }, select: { id: true } });
    const lessons = await prisma.lesson.findMany({ where: { childId: { in: children.map((child) => child.id) } }, include: { teacherProfile: { select: { displayName: true } }, feedbackVersions: { where: { isCurrent: true }, select: { id: true } }, review: { select: { id: true } } }, orderBy: { startsAt: "desc" }, take: 100 });
    return { lessons: lessons.map((item) => ({ id: item.id, childId: item.childId, teacherProfileId: item.teacherProfileId, teacherDisplayName: item.teacherProfile.displayName, subject: item.subject, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), status: item.status, mode: item.mode, hasFeedback: item.feedbackVersions.length > 0, hasReview: Boolean(item.review), completedAt: item.completedAt?.toISOString() ?? null })) };
  });
}

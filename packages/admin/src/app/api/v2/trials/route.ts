import type { NextRequest } from "next/server";
import { resolveRoleContext } from "@lightning-tiger/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const ctx = await resolveRoleContext({ userId }, "parent");
    const trials = await prisma.trialBooking.findMany({ where: { parentProfileId: ctx.parentProfileId! }, include: { teacherProfile: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    return { trials: trials.map((item) => ({ ...item, teacherDisplayName: item.teacherProfile.displayName, teacherProfile: undefined, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })) };
  });
}

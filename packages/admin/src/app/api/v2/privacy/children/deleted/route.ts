import { AppError } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const parent = await prisma.parentProfile.findUnique({ where: { userId } });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    const children = await prisma.child.findMany({ where: { parentProfileId: parent.id, deletedAt: { not: null }, purgeAfter: { gt: new Date() } }, orderBy: { deletedAt: "desc" } });
    return { children: children.map((child) => ({ id: child.id, displayName: child.name, grade: child.grade, birthDate: child.birthDate?.toISOString() ?? null, deletedAt: child.deletedAt?.toISOString() ?? "", purgeAfter: child.purgeAfter?.toISOString() ?? "" })) };
  });
}

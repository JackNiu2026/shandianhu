import { AppError, JobService, PrivacyDeletionService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";
import { prisma } from "@/server/prisma";

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const parent = await prisma.parentProfile.findUnique({ where: { userId } });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    const children = await prisma.child.findMany({ where: { parentProfileId: parent.id, deletedAt: { not: null }, purgeAfter: { gt: new Date() } }, orderBy: { deletedAt: "desc" } });
    return { children: children.map((child) => ({ id: child.id, displayName: child.name, grade: child.grade, birthDate: child.birthDate?.toISOString() ?? null, deletedAt: child.deletedAt?.toISOString() ?? null, purgeAfter: child.purgeAfter?.toISOString() ?? null })) };
  });
}

const privacy = new PrivacyDeletionService(undefined, new JobService());

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid child ID");
    await privacy.softDeleteChild(userId, id);
    return { deletedChildId: id, recoveryDays: 30 };
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid child ID");
    await privacy.restoreChild(userId, id);
    return { restoredChildId: id };
  });
}

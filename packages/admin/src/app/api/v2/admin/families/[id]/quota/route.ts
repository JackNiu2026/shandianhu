import { QuotaService, AuditService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin, makeAdminContext } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

const quota = new QuotaService(prisma as unknown as ConstructorParameters<typeof QuotaService>[0]);
const audit = new AuditService();

const adjustSchema = z
  .object({
    points: z.number().int(),
    reason: z.string().min(1).max(200),
    operationKey: z.string().min(1).max(128),
    childId: z.string().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    await requireSuperadmin(_request);
    const { id: parentProfileId } = await params;
    const summary = await quota.getAccount(parentProfileId);
    if (!summary) {
      return {
        account: {
          parentProfileId,
          accountId: null,
          availablePoints: "0",
          reservedPoints: "0",
          totalPoints: "0",
        },
        ledgers: [],
      };
    }
    const ledgers = await quota.listLedgers(parentProfileId, 100);
    return {
      account: {
        parentProfileId: summary.parentProfileId,
        accountId: summary.accountId,
        availablePoints: summary.availablePoints.toString(),
        reservedPoints: summary.reservedPoints.toString(),
        totalPoints: summary.totalPoints.toString(),
      },
      ledgers: ledgers.map((l) => ({
        id: l.id,
        kind: l.kind,
        points: l.points.toString(),
        balanceAfter: l.balanceAfter.toString(),
        childId: l.childId,
        modelCallId: l.modelCallId,
        reservationId: l.reservationId,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    const { id: parentProfileId } = await params;
    const ctx = makeAdminContext(admin.adminUserId);
    const body = adjustSchema.safeParse(await request.json());
    if (!body.success) {
      throw { code: "VALIDATION_ERROR", status: 400, message: body.error.message };
    }
    const input = body.data;
    const result = await quota.adjust({
      parentProfileId,
      operationKey: input.operationKey,
      points: BigInt(input.points),
      reason: input.reason,
      adminUserId: admin.adminUserId,
      childId: input.childId,
    });
    const account = await quota.getAccount(parentProfileId);
    await audit.record({
      actorKind: "ADMIN",
      actorAdminUserId: admin.adminUserId,
      entityType: "TUTOR_QUOTA_ACCOUNT",
      entityId: account?.accountId ?? parentProfileId,
      action: "UPDATE",
      diff: {
        operationKey: input.operationKey,
        points: input.points,
        reason: input.reason,
        childId: input.childId ?? null,
        availableAfter: result.availableAfter.toString(),
        requestId: ctx.requestId,
      },
    });
    return {
      ledgerId: result.ledgerId,
      accountId: result.accountId,
      adjustedPoints: result.adjustedPoints.toString(),
      availableAfter: result.availableAfter.toString(),
    };
  });
}

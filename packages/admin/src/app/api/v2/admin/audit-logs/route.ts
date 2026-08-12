import { z } from "zod";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { requireSuperadmin } from "@/lib/api-auth";
import { prisma } from "@/server/prisma";
import { randomUUID } from "node:crypto";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  actorKind: z.enum(["USER", "ADMIN", "SYSTEM", "ASYNC_JOB"]).optional(),
  entityType: z.enum([
    "USER", "CHILD", "ASSESSMENT_RUN", "LEARNING_REPORT", "FILE_OBJECT",
    "MODEL_CONFIG", "AGENT_CONFIG", "AGENT_PROMPT_VERSION",
    "TUTOR_CONVERSATION", "TUTOR_QUOTA_ACCOUNT",
  ]).optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "SHARE", "REVOKE"]).optional(),
  actorId: z.string().optional(),
  entityId: z.string().optional(),
  fromIso: z.string().optional(),
  toIso: z.string().optional(),
});

// GET /api/v2/admin/audit-logs — 安全审计查询
export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    void admin;
    const params = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!params.success) {
      throw { code: "VALIDATION_ERROR", status: 400, message: params.error.message };
    }
    const q = params.data;

    const where: Record<string, unknown> = {};
    if (q.actorKind) where.actorKind = q.actorKind;
    if (q.entityType) where.entityType = q.entityType;
    if (q.action) where.action = q.action;
    if (q.actorId) where.actorId = q.actorId;
    if (q.entityId) where.entityId = q.entityId;
    const createdAt: Record<string, Date> = {};
    if (q.fromIso) createdAt.gte = new Date(q.fromIso);
    if (q.toIso) createdAt.lte = new Date(q.toIso);
    if (Object.keys(createdAt).length) where.createdAt = createdAt;
    if (q.cursor) where.id = { lt: q.cursor };

    const logs = await prisma.auditLog.findMany({
      take: q.limit + 1,
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        actorKind: true,
        actorId: true,
        actorAdminUserId: true,
        actorUserId: true,
        subjectUserId: true,
        childId: true,
        asyncJobId: true,
        assessmentRunId: true,
        learningReportId: true,
        entityType: true,
        entityId: true,
        action: true,
        sanitizedDiff: true,
        createdAt: true,
      },
    });
    const hasMore = logs.length > q.limit;
    const rows = logs.slice(0, q.limit);
    const nextCursor = hasMore ? rows[rows.length - 1].id : null;
    return {
      items: rows.map((r) => ({
        id: r.id,
        actorKind: r.actorKind,
        actorId: r.actorId,
        actorAdminUserId: r.actorAdminUserId,
        actorUserId: r.actorUserId,
        subjectUserId: r.subjectUserId,
        childId: r.childId,
        asyncJobId: r.asyncJobId,
        assessmentRunId: r.assessmentRunId,
        learningReportId: r.learningReportId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        diff: r.sanitizedDiff,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  });
}

// POST /api/v2/admin/audit-logs — 管理员手动录入（用于运营补偿，需审计本身）
const writeSchema = z.object({
  actorKind: z.enum(["ADMIN", "SYSTEM"]),
  actorAdminUserId: z.string().optional(),
  subjectUserId: z.string().optional(),
  childId: z.string().optional(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "SHARE", "REVOKE"]),
  diff: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().max(500),
});

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    const body = writeSchema.safeParse(await request.json());
    if (!body.success) {
      throw { code: "VALIDATION_ERROR", status: 400, message: body.error.message };
    }
    const b = body.data;
    const id = `alog-${randomUUID()}`;
    const { AuditService, sanitizeAuditDiff } = await import("@lightning-tiger/server");
    const svc = new AuditService();
    await svc.record({
      actorKind: b.actorKind,
      actorAdminUserId: admin.adminUserId,
      subjectUserId: b.subjectUserId,
      childId: b.childId,
      entityType: b.entityType as any,
      entityId: b.entityId,
      action: b.action,
      diff: { reason: b.reason, operatorAdminUserId: admin.adminUserId, payload: b.diff },
    });
    return { id };
  });
}

import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

const schema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().min(1).max(100).default(30), status: z.enum(["UNREAD", "READ"]).optional(), type: z.string().optional(), userId: z.string().optional(), childId: z.string().optional() });
export async function GET(request: NextRequest) { return toHttpResponse(async () => { await requireAdmin(request); const q = schema.parse(Object.fromEntries(new URL(request.url).searchParams)); const rows = await prisma.notification.findMany({ where: { ...(q.status ? { status: q.status } : {}), ...(q.type ? { type: q.type as any } : {}), ...(q.userId ? { userId: q.userId } : {}), ...(q.childId ? { childId: q.childId } : {}), ...(q.cursor ? { id: { lt: q.cursor } } : {}) }, take: q.limit + 1, orderBy: { id: "desc" }, select: { id: true, userId: true, childId: true, type: true, status: true, body: true, targetRoute: true, targetParams: true, readAt: true, createdAt: true } }); const items = rows.slice(0, q.limit); return { items: items.map((row) => ({ ...row, body: summarize(row.body), readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() })), nextCursor: rows.length > q.limit ? items.at(-1)?.id ?? null : null }; }); }
function summarize(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/phone|openId|unionId|token/i.test(key)).slice(0, 8)); }

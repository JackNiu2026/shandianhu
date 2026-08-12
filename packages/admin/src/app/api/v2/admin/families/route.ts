import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";
import { prisma } from "@/server/prisma";

const schema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().min(1).max(100).default(20), search: z.string().trim().optional() });
export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    await requireAdmin(request); const query = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const rows = await prisma.parentProfile.findMany({ where: query.search ? { OR: [{ id: { contains: query.search } }, { displayName: { contains: query.search, mode: "insensitive" } }, { children: { some: { name: { contains: query.search, mode: "insensitive" } } } }] } : undefined, cursor: query.cursor ? { id: query.cursor } : undefined, skip: query.cursor ? 1 : 0, take: query.limit + 1, orderBy: { id: "asc" }, include: { user: { select: { displayName: true, phone: true, createdAt: true, updatedAt: true } }, children: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, grade: true, birthDate: true, deletedAt: true, purgeAfter: true } }, quotaAccount: { select: { availablePoints: true, reservedPoints: true, version: true } } } });
    const items = rows.slice(0, query.limit);
    return { items: items.map((row) => ({ id: row.id, displayName: row.displayName ?? row.user.displayName ?? "未命名家庭", phoneMasked: maskPhone(row.user.phone), activeChildId: row.activeChildId, children: row.children.map((child) => ({ ...child, birthDate: child.birthDate?.toISOString() ?? null, deletedAt: child.deletedAt?.toISOString() ?? null, purgeAfter: child.purgeAfter?.toISOString() ?? null })), quota: row.quotaAccount ? { availablePoints: Number(row.quotaAccount.availablePoints), reservedPoints: Number(row.quotaAccount.reservedPoints), version: row.quotaAccount.version } : null, createdAt: row.user.createdAt.toISOString(), lastActiveAt: row.user.updatedAt.toISOString() })), nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  });
}
function maskPhone(phone: string | null): string | null { return phone ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : null; }

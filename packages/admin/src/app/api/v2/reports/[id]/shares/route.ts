import { AppError, ReportShareService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const shares = new ReportShareService();
const issueSchema = z.object({ expiresInSeconds: z.number().int().positive().optional() }).strict();
const revokeSchema = z.object({ shareId: z.string().min(1) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }, body] = await Promise.all([authenticatedUserId(request), context.params, request.json()]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid report ID");
    const parsed = issueSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid share request");
    return shares.issue(id, userId, parsed.data.expiresInSeconds);
  });
}

export async function DELETE(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, body] = await Promise.all([authenticatedUserId(request), request.json()]);
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid share request");
    await shares.revoke(parsed.data.shareId, userId);
    return { revoked: true };
  });
}

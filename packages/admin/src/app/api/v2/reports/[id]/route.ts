import { AppError, ReportService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const reports = new ReportService();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid report ID");
    const report = await reports.getForUser(userId, id);
    return {
      id: report.id,
      childId: report.childId,
      sequence: report.sequence,
      status: report.status,
      narrativeVersion: report.narrativeVersion,
      body: report.body,
      publishedAt: (report as { publishedAt?: Date | null }).publishedAt?.toISOString() ?? null,
      hasPdf: Boolean(report.fileObjectId),
    };
  });
}

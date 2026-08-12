import { AppError, FileService, ReportService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const reports = new ReportService();
const files = new FileService();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid report ID");
    const report = await reports.getForUser(userId, id);
    if (report.status !== "READY" || !report.fileObjectId) {
      throw new AppError("NOT_FOUND", 404, "Report PDF is not ready");
    }
    return files.issueDownload(userId, report.fileObjectId);
  });
}

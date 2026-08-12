import { AppError, FileService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const files = new FileService();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid file ID");
    return files.issueDownload(userId, id);
  });
}

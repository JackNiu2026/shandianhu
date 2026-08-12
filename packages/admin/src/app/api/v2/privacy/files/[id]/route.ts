import { AppError, JobService, PrivacyDeletionService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const privacy = new PrivacyDeletionService(undefined, new JobService());

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid file ID");
    await privacy.deleteAssessmentSource(userId, id);
    return { deletedFileId: id };
  });
}

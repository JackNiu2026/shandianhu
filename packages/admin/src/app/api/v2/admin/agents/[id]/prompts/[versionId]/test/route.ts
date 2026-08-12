import { AppError, PromptTestService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { makeAdminContext, requireSuperadmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const testService = new PromptTestService();

const testSchema = z
  .object({
    testInput: z.string().min(1).max(4096),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    const { id, versionId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid test input");

    const result = await testService.runTest(id, versionId, parsed.data.testInput, makeAdminContext(admin.adminUserId));
    return { result };
  });
}

import { AppError, PromptService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { makeAdminContext, requireSuperadmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const prompts = new PromptService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  return toHttpResponse(async () => {
    await requireSuperadmin(request);
    const { id, versionId } = await params;
    const version = await prompts.getVersion(versionId);
    if (version.agentId !== id) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt version does not belong to this agent");
    }
    return { version };
  });
}

const updateContentSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

export async function PATCH(
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
    const parsed = updateContentSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid prompt content");

    const version = await prompts.updateContent(versionId, parsed.data.content, makeAdminContext(admin.adminUserId));
    if (version.agentId !== id) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt version does not belong to this agent");
    }
    return { version };
  });
}

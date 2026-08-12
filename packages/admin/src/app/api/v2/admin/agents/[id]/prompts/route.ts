import { AppError, PromptService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { makeAdminContext, requireSuperadmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const prompts = new PromptService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    await requireSuperadmin(request);
    const { id } = await params;
    const versions = await prompts.listVersions(id);
    return {
      versions: versions.map((v) => ({
        id: v.id,
        agentId: v.agentId,
        sequence: v.sequence,
        checksum: v.checksum,
        status: v.status,
        createdById: v.createdById,
        publishedAt: v.publishedAt,
        supersedesId: v.supersedesId,
        createdAt: v.createdAt,
      })),
    };
  });
}

const createSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid prompt content");

    const version = await prompts.createDraft(id, parsed.data.content, makeAdminContext(admin.adminUserId));
    return { version };
  });
}

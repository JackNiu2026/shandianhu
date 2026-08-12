import { AgentService, AppError } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, requireSuperadmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const agents = new AgentService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toHttpResponse(async () => {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const agent = await agents.findById(id);
    if (!agent) throw new AppError("NOT_FOUND", 404, "Agent not found");

    const isSuperadmin = admin.role === "SUPERADMIN";
    return {
      agent: {
        ...agent,
        publishedPromptVersion: agent.publishedPromptVersion
          ? isSuperadmin
            ? agent.publishedPromptVersion
            : {
                id: agent.publishedPromptVersion.id,
                sequence: agent.publishedPromptVersion.sequence,
                checksum: agent.publishedPromptVersion.checksum,
              }
          : null,
      },
    };
  });
}

const updateSchema = z
  .object({
    status: z.enum(["ENABLED", "DISABLED"]).optional(),
    primaryModelConfigId: z.string().nullable().optional(),
    fallbackModelConfigId: z.string().nullable().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
  })
  .strict();

export async function PATCH(
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid agent configuration");

    const { status, ...config } = parsed.data;
    if (status) {
      await agents.setStatus(id, status, admin.adminUserId);
    }
    if (Object.keys(config).length > 0) {
      await agents.updateConfig(id, config, admin.adminUserId);
    }

    const updated = await agents.findById(id);
    if (!updated) throw new AppError("NOT_FOUND", 404, "Agent not found");
    return { agent: updated };
  });
}

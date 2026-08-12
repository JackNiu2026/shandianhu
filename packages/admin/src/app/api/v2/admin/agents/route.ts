import { AgentService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const agents = new AgentService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    await requireAdmin(request);
    const list = await agents.listAll();
    return {
      agents: list.map((a) => ({
        id: a.id,
        subject: a.subject,
        schoolStage: a.schoolStage,
        status: a.status,
        publishedPromptSequence: a.publishedPromptVersion?.sequence ?? null,
        hasPrimaryModel: Boolean(a.primaryModelConfigId),
        hasFallbackModel: Boolean(a.fallbackModelConfigId),
        temperature: a.temperature,
        maxOutputTokens: a.maxOutputTokens,
      })),
    };
  });
}

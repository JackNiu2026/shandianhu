import { PromptService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { makeAdminContext, requireSuperadmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const prompts = new PromptService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  return toHttpResponse(async () => {
    const admin = await requireSuperadmin(request);
    const { id, versionId } = await params;

    const version = await prompts.rollback(id, versionId, makeAdminContext(admin.adminUserId));
    return { version };
  });
}

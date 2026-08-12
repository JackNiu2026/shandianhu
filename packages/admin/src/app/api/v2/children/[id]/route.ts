import { ChildService, JobService, PrivacyDeletionService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { parseChildInput } from "@/lib/api/children";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const children = new ChildService();
const privacy = new PrivacyDeletionService(undefined, new JobService());

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [{ id }, userId, input] = await Promise.all([
      params,
      authenticatedUserId(request),
      parseChildInput(request, false),
    ]);
    return { child: await children.updateChild(userId, id, input) };
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [{ id }, userId] = await Promise.all([params, authenticatedUserId(request)]);
    await privacy.softDeleteChild(userId, id);
    return { deletedChildId: id };
  });
}

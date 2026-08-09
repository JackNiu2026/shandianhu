import { ChildService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId, parseChildInput } from "../child-route-helpers";

const children = new ChildService();

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
    await children.softDeleteChild(userId, id);
    return { deletedChildId: id };
  });
}

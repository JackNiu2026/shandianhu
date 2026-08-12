import { ChildService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { parseChildInput } from "@/lib/api/children";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const children = new ChildService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    return children.getChildWorkspace(userId);
  });
}

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, input] = await Promise.all([
      authenticatedUserId(request),
      parseChildInput(request, true),
    ]);
    return { child: await children.createChild(userId, input as { displayName: string }) };
  });
}

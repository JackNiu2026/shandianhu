import { ChildService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId, parseActiveChildId } from "../child-route-helpers";

const children = new ChildService();

export async function PUT(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, childId] = await Promise.all([authenticatedUserId(request), parseActiveChildId(request)]);
    return { child: await children.setActiveChild(userId, childId) };
  });
}

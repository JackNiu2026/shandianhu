import { NotificationService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const notifications = new NotificationService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    const params = request.nextUrl.searchParams;
    const limitRaw = params.get("limit");
    const cursor = params.get("cursor") ?? undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return notifications.listForUser(userId, {
      limit: limit && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined,
      cursor,
    });
  });
}

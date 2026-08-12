import { AppError, NotificationService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const notifications = new NotificationService();

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
    }

    const notificationId = typeof (body as { notificationId?: unknown })?.notificationId === "string"
      ? (body as { notificationId: string }).notificationId
      : undefined;

    if (notificationId) {
      await notifications.markAsRead(userId, notificationId);
      return { ok: true };
    }
    const result = await notifications.markAllAsRead(userId);
    return { count: result.count };
  });
}

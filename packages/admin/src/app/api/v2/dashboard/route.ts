import { ParentDashboardService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
import { authenticatedUserId } from "@/lib/v2-auth";

const dashboard = new ParentDashboardService();

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    const userId = await authenticatedUserId(request);
    return dashboard.load(userId);
  });
}

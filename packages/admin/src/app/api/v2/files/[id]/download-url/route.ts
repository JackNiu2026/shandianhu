import { AppError, FileService, resolveSession } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";

const files = new FileService();

async function authenticatedUserId(request: NextRequest): Promise<string> {
  const [scheme, token] = request.headers.get("authorization")?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  }

  return (await resolveSession(token)).userId;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return toHttpResponse(async () => {
    const [userId, { id }] = await Promise.all([authenticatedUserId(request), context.params]);
    if (!id) throw new AppError("VALIDATION_ERROR", 400, "Invalid file ID");
    return files.issueDownload(userId, id);
  });
}

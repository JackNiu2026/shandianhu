import { AppError, FileService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const files = new FileService();
const uploadInputSchema = z.object({
  childId: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
}).strict();

async function parseUploadInput(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
  }

  const parsed = uploadInputSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid upload request");
  return parsed.data;
}

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, input] = await Promise.all([authenticatedUserId(request), parseUploadInput(request)]);
    return files.issueUpload(userId, input.childId, input);
  });
}

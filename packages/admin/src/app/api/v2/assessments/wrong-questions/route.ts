import { AppError, WrongQuestionService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const service = new WrongQuestionService();
const inputSchema = z.object({
  childId: z.string().min(1),
  fileIds: z.array(z.string().min(1)).min(1).max(9),
  idempotencyKey: z.string().min(1).max(128),
}).strict();

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, body] = await Promise.all([authenticatedUserId(request), request.json()]);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid diagnosis submission");
    return service.submit(userId, parsed.data);
  });
}

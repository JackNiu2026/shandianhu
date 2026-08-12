import { AppError, ChildService, JobService, LearningStyleAssessmentService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedUserId } from "@/lib/v2-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const assessments = new LearningStyleAssessmentService(undefined, new ChildService(), new JobService());
const inputSchema = z.object({
  childId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    option: z.enum(["A", "B"]),
  }).strict()),
}).strict();

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const [userId, body] = await Promise.all([authenticatedUserId(request), request.json()]);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid learning style submission");
    return assessments.submit(userId, parsed.data);
  });
}

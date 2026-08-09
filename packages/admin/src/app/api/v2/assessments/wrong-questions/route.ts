import { AppError, ChildService, JobService, WrongQuestionService, resolveSession } from "@lightning-tiger/server";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { toHttpResponse } from "@/lib/v2-handler";
const service = new WrongQuestionService(undefined, new ChildService(), new JobService());
const input = z.object({ childId: z.string().min(1), fileIds: z.array(z.string().min(1)).min(1).max(9), idempotencyKey: z.string().min(1) }).strict();
export async function POST(request: NextRequest) { return toHttpResponse(async () => { const token = request.headers.get("authorization")?.split(" ")[1]; if (!token) throw new AppError("UNAUTHENTICATED", 401, "Authentication required"); const parsed = input.safeParse(await request.json()); if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid diagnosis submission"); return service.submit((await resolveSession(token)).userId, parsed.data); }); }

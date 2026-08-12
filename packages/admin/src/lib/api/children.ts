import { AppError, type ChildInput } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

const childInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  grade: z.string().trim().min(1).max(40).nullable().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  schoolName: z.string().trim().max(120).nullable().optional(),
  learningGoals: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
}).strict();

const activeChildSchema = z.object({ childId: z.string().min(1) }).strict();

export async function parseChildInput(
  request: NextRequest,
  requireName: boolean,
): Promise<ChildInput & { displayName?: string }> {
  const body = await parseJson(request);
  const parsed = childInputSchema.safeParse(body);
  if (!parsed.success || (requireName && !parsed.data.displayName)) {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid child profile");
  }

  return {
    ...parsed.data,
    birthDate: parsed.data.birthDate === undefined || parsed.data.birthDate === null
      ? parsed.data.birthDate
      : new Date(parsed.data.birthDate),
  };
}

export async function parseActiveChildId(request: NextRequest): Promise<string> {
  const parsed = activeChildSchema.safeParse(await parseJson(request));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid active child");
  return parsed.data.childId;
}

async function parseJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
  }
}

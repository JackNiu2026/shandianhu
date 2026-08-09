import { AppError, ModelConfigService } from "@lightning-tiger/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateAdmin } from "@/lib/api-auth";
import { toHttpResponse } from "@/lib/v2-handler";

const models = new ModelConfigService();
const inputSchema = z.object({
  provider: z.enum(["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "OTHER"]),
  endpointUrl: z.string().url(),
  apiKey: z.string().min(1),
  modelName: z.string().min(1),
  capabilities: z.enum(["TEXT", "VISION", "EMBEDDING"]),
  visionEnabled: z.boolean(),
  timeoutMs: z.number().int().positive().max(120_000),
  maxOutputTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
  inputCostMicros: z.number().int().nonnegative(),
  outputCostMicros: z.number().int().nonnegative(),
  imageCostMicros: z.number().int().nonnegative(),
  enabled: z.boolean(),
}).strict();

async function authenticatedAdmin(request: NextRequest): Promise<{ adminUserId: string; role: string }> {
  const auth = await authenticateAdmin(request);
  if (auth.response || !auth.adminUserId) throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  return { adminUserId: auth.adminUserId, role: auth.role };
}

async function parseInput(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Request body must be valid JSON");
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", 400, "Invalid model configuration");
  return parsed.data;
}

export async function GET(request: NextRequest) {
  return toHttpResponse(async () => {
    await authenticatedAdmin(request);
    return { models: await models.list() };
  });
}

export async function POST(request: NextRequest) {
  return toHttpResponse(async () => {
    const admin = await authenticatedAdmin(request);
    if (admin.role !== "SUPERADMIN") throw new AppError("FORBIDDEN", 403, "Superadmin access required");
    const input = await parseInput(request);
    return { model: await models.create(input, admin.adminUserId) };
  });
}

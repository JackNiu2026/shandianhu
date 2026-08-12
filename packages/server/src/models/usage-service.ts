import { prisma } from "../db/client";

export type ModelUsagePurpose = "ASSESSMENT" | "PROFILE_GENERATION" | "REPORT_GENERATION" | "AI_TUTORING" | "PROMPT_TEST" | "OTHER";
export type ModelUsageStatus = "SUCCEEDED" | "FAILED" | "CANCELLED";

export type UsageLedgerEntry = {
  callId: string;
  modelConfigId: string;
  userId?: string;
  childId?: string;
  purpose: ModelUsagePurpose;
  status: ModelUsageStatus;
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  latencyMs: number;
  microCost: bigint;
  sanitizedError?: string;
};

export interface ModelUsageDatabase {
  modelUsageLedger: { create(args: { data: UsageLedgerEntry }): Promise<unknown> };
}

export class UsageService {
  constructor(private readonly database: ModelUsageDatabase = prisma as unknown as ModelUsageDatabase) {}

  async record(entry: UsageLedgerEntry): Promise<void> {
    await this.database.modelUsageLedger.create({ data: entry });
  }
}

export function calculateMicroCost(
  inputTokens: number,
  outputTokens: number,
  imageCount: number,
  prices: { inputCostMicros: bigint; outputCostMicros: bigint; imageCostMicros: bigint },
): bigint {
  return (BigInt(inputTokens) * prices.inputCostMicros) / 1000n
    + (BigInt(outputTokens) * prices.outputCostMicros) / 1000n
    + BigInt(imageCount) * prices.imageCostMicros;
}

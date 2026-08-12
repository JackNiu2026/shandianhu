import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import { ModelConfigGatewayConfigResolver } from "./model-config-service";
import { UsageService, calculateMicroCost, type ModelUsagePurpose, type UsageLedgerEntry } from "./usage-service";

export type ModelGatewayConfig = {
  id: string;
  provider: "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC" | "OTHER";
  endpointUrl: string;
  apiKey: string;
  modelName: string;
  capabilities: "TEXT" | "VISION" | "EMBEDDING";
  visionEnabled: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: string;
  inputCostMicros: bigint;
  outputCostMicros: bigint;
  imageCostMicros: bigint;
  enabled: boolean;
};

export type ModelContent = string | Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
>;
export type ModelMessage = { role: "system" | "user" | "assistant"; content: ModelContent };
export type StructuredCompletionInput<T> = {
  purpose: ModelUsagePurpose;
  messages: ModelMessage[];
  schema: z.ZodType<T>;
  userId?: string;
  childId?: string;
  imageCount?: number;
  callId?: string;
};

export type TextCompletionInput = {
  purpose: ModelUsagePurpose;
  messages: ModelMessage[];
  userId?: string;
  childId?: string;
  imageCount?: number;
  callId?: string;
};

type GatewayDependencies = {
  fetch: typeof fetch;
  clock: () => number;
  id: () => string;
  config: { getEnabled(): Promise<ModelGatewayConfig | null> };
  ledger: { record(entry: UsageLedgerEntry): Promise<void> };
};

const defaultDependencies: GatewayDependencies = {
  fetch,
  clock: Date.now,
  id: randomUUID,
  config: new ModelConfigGatewayConfigResolver(),
  ledger: new UsageService(),
};

export class OpenAiCompatibleGateway {
  constructor(private readonly dependencies: GatewayDependencies = defaultDependencies) {}

  async complete<T>(input: StructuredCompletionInput<T>): Promise<{ callId: string; output: T }> {
    const config = await this.dependencies.config.getEnabled();
    if (!config || !config.enabled) throw new AppError("MODEL_UNAVAILABLE", 503, "Model is unavailable");

    const callId = input.callId ?? this.dependencies.id();
    const startedAt = this.dependencies.clock();
    const imageCount = input.imageCount ?? 0;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      let providerResponse: Response;
      try {
        providerResponse = await this.dependencies.fetch(chatCompletionsUrl(config.endpointUrl), {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.modelName,
            messages: input.messages,
            temperature: Number(config.temperature),
            max_tokens: config.maxOutputTokens,
            response_format: { type: "json_schema", json_schema: { name: "structured_output", strict: true, schema: { type: "object" } } },
          }),
        });
      } catch (error) {
        throw modelUnavailable(error instanceof Error && error.name === "AbortError" ? "Model request timed out" : "Model provider request failed");
      } finally {
        clearTimeout(timeout);
      }
      if (!providerResponse.ok) {
        throw modelUnavailable(providerResponse.status === 429 ? "Model provider is rate limited" : "Model provider is unavailable", providerResponse.status === 429 ? 429 : 503);
      }

      const providerBody = await safeJson(providerResponse);
      const content = contentFrom(providerBody);
      const parsedJson = parseJson(content);
      const validation = input.schema.safeParse(parsedJson);
      if (!validation.success) throw modelUnavailable("Model response did not match the requested schema");

      const usage = usageFrom(providerBody);
      await this.recordUsage(successEntry(callId, config, input, usage, imageCount, this.elapsed(startedAt)));
      return { callId, output: validation.data };
    } catch (error) {
      const appError = error instanceof AppError ? error : modelUnavailable("Model provider request failed");
      await this.recordUsage(failureEntry(callId, config, input, imageCount, this.elapsed(startedAt), appError.message));
      throw appError;
    }
  }

  async completeText(input: TextCompletionInput): Promise<{ callId: string; output: string }> {
    const config = await this.dependencies.config.getEnabled();
    if (!config || !config.enabled) throw new AppError("MODEL_UNAVAILABLE", 503, "Model is unavailable");

    const callId = input.callId ?? this.dependencies.id();
    const startedAt = this.dependencies.clock();
    const imageCount = input.imageCount ?? 0;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      let providerResponse: Response;
      try {
        providerResponse = await this.dependencies.fetch(chatCompletionsUrl(config.endpointUrl), {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.modelName,
            messages: input.messages,
            temperature: Number(config.temperature),
            max_tokens: config.maxOutputTokens,
          }),
        });
      } catch (error) {
        throw modelUnavailable(error instanceof Error && error.name === "AbortError" ? "Model request timed out" : "Model provider request failed");
      } finally {
        clearTimeout(timeout);
      }
      if (!providerResponse.ok) {
        throw modelUnavailable(providerResponse.status === 429 ? "Model provider is rate limited" : "Model provider is unavailable", providerResponse.status === 429 ? 429 : 503);
      }

      const providerBody = await safeJson(providerResponse);
      const output = contentFrom(providerBody);
      const usage = usageFrom(providerBody);
      await this.recordUsage(successEntry(callId, config, input, usage, imageCount, this.elapsed(startedAt)));
      return { callId, output };
    } catch (error) {
      const appError = error instanceof AppError ? error : modelUnavailable("Model provider request failed");
      await this.recordUsage(failureEntry(callId, config, input, imageCount, this.elapsed(startedAt), appError.message));
      throw appError;
    }
  }

  private elapsed(startedAt: number): number {
    return Math.max(0, Math.round(this.dependencies.clock() - startedAt));
  }

  private async recordUsage(entry: UsageLedgerEntry): Promise<void> {
    try {
      await this.dependencies.ledger.record(entry);
    } catch {
      // Telemetry persistence must never alter the provider result or create a duplicate call record.
    }
  }
}

function chatCompletionsUrl(endpointUrl: string): string {
  const endpoint = endpointUrl.replace(/\/+$/, "");
  return endpoint.endsWith("/chat/completions") ? endpoint : `${endpoint}/chat/completions`;
}

async function safeJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw modelUnavailable("Model provider returned invalid JSON"); }
}

function contentFrom(body: unknown): string {
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw modelUnavailable("Model provider returned a malformed response");
  return content;
}

function parseJson(content: string): unknown {
  try { return JSON.parse(content); } catch { throw modelUnavailable("Model provider returned invalid structured output"); }
}

function usageFrom(body: unknown): { inputTokens: number; outputTokens: number } {
  const usage = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
  return {
    inputTokens: numberOrZero(usage?.prompt_tokens),
    outputTokens: numberOrZero(usage?.completion_tokens),
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

type CompletionInputBase = {
  userId?: string;
  childId?: string;
  purpose: ModelUsagePurpose;
};

function successEntry(callId: string, config: ModelGatewayConfig, input: CompletionInputBase, usage: { inputTokens: number; outputTokens: number }, imageCount: number, latencyMs: number): UsageLedgerEntry {
  return { callId, modelConfigId: config.id, userId: input.userId, childId: input.childId, purpose: input.purpose, status: "SUCCEEDED", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, imageCount, latencyMs, microCost: calculateMicroCost(usage.inputTokens, usage.outputTokens, imageCount, config) };
}

function failureEntry(callId: string, config: ModelGatewayConfig, input: CompletionInputBase, imageCount: number, latencyMs: number, sanitizedError: string): UsageLedgerEntry {
  return { callId, modelConfigId: config.id, userId: input.userId, childId: input.childId, purpose: input.purpose, status: "FAILED", inputTokens: 0, outputTokens: 0, imageCount, latencyMs, microCost: 0n, sanitizedError };
}

function modelUnavailable(message: string, status = 503): AppError {
  return new AppError("MODEL_UNAVAILABLE", status, message);
}

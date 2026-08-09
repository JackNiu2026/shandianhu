import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import { OpenAiCompatibleGateway, type ModelGatewayConfig } from "./openai-gateway";

const config: ModelGatewayConfig = {
  id: "model-1",
  provider: "OPENAI",
  endpointUrl: "https://models.example.test/v1",
  apiKey: "secret-key",
  modelName: "compact-model",
  capabilities: "TEXT",
  visionEnabled: false,
  timeoutMs: 50,
  maxOutputTokens: 120,
  temperature: "0.2",
  inputCostMicros: 1500n,
  outputCostMicros: 3000n,
  imageCostMicros: 7000n,
  enabled: true,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenAiCompatibleGateway", () => {
  it("validates structured output and records an exact successful cost ledger entry", async () => {
    const ledger: unknown[] = [];
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    let now = 1_000;
    const gateway = new OpenAiCompatibleGateway({
      fetch: async (url, init) => {
        fetchCalls.push({ url: String(url), init: init! });
        now = 1_025;
        return response({
          choices: [{ message: { content: '{"summary":"Ready"}' } }],
          usage: { prompt_tokens: 1200, completion_tokens: 250 },
        });
      },
      clock: () => now,
      id: () => "call-1",
      config: { getEnabled: async () => config },
      ledger: { record: async (entry) => { ledger.push(entry); } },
    });

    const result = await gateway.complete({
      purpose: "ASSESSMENT",
      messages: [{ role: "user", content: "private prompt" }],
      schema: z.object({ summary: z.string() }),
      imageCount: 2,
    });

    expect(result).toEqual({ callId: "call-1", output: { summary: "Ready" } });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe("https://models.example.test/v1/chat/completions");
    expect(fetchCalls[0]?.init.headers).toMatchObject({ Authorization: "Bearer secret-key" });
    expect(JSON.parse(String(fetchCalls[0]?.init.body))).toMatchObject({
      model: "compact-model",
      response_format: { type: "json_schema" },
      max_tokens: 120,
    });
    expect(ledger).toEqual([{
      callId: "call-1",
      modelConfigId: "model-1",
      purpose: "ASSESSMENT",
      status: "SUCCEEDED",
      inputTokens: 1200,
      outputTokens: 250,
      imageCount: 2,
      latencyMs: 25,
      microCost: 16_550n,
    }]);
  });

  it("normalizes provider failures and records no API key or response details", async () => {
    const ledger: unknown[] = [];
    const gateway = new OpenAiCompatibleGateway({
      fetch: async () => response({ error: { message: "secret-key must not escape" } }, 429),
      clock: () => 1_000,
      id: () => "call-2",
      config: { getEnabled: async () => config },
      ledger: { record: async (entry) => { ledger.push(entry); } },
    });

    await expect(gateway.complete({
      purpose: "OTHER",
      messages: [{ role: "user", content: "private prompt" }],
      schema: z.object({ summary: z.string() }),
    })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", status: 429 });

    expect(String(ledger[0])).not.toContain("secret-key");
    expect(String(ledger[0])).not.toContain("private prompt");
    expect(ledger).toEqual([expect.objectContaining({
      callId: "call-2",
      status: "FAILED",
      sanitizedError: "Model provider is rate limited",
      microCost: 0n,
    })]);
  });

  it("does not mask a successful completion or duplicate a call when telemetry persistence fails", async () => {
    const ledger: unknown[] = [];
    const gateway = new OpenAiCompatibleGateway({
      fetch: async () => response({
        choices: [{ message: { content: '{"summary":"Ready"}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      clock: () => 1_000,
      id: () => "call-3",
      config: { getEnabled: async () => config },
      ledger: { record: async (entry) => { ledger.push(entry); throw new Error("ledger unavailable"); } },
    });

    await expect(gateway.complete({
      purpose: "OTHER",
      messages: [{ role: "user", content: "private prompt" }],
      schema: z.object({ summary: z.string() }),
    })).resolves.toEqual({ callId: "call-3", output: { summary: "Ready" } });

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ callId: "call-3", status: "SUCCEEDED" });
  });
});

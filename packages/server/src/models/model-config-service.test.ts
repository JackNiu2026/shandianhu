import { describe, expect, it } from "vitest";
import { ModelConfigGatewayConfigResolver, ModelConfigService, type ModelConfigRecord } from "./model-config-service";

const record: ModelConfigRecord = {
  id: "model-1",
  provider: "OPENAI",
  endpointUrl: "https://models.example.test/v1",
  apiKeyCiphertext: "ciphertext",
  apiKeyIv: "iv",
  apiKeyTag: "tag",
  modelName: "compact-model",
  capabilities: "TEXT",
  visionEnabled: false,
  timeoutMs: 30_000,
  maxOutputTokens: 1024,
  temperature: "0.2",
  inputCostMicros: 1500n,
  outputCostMicros: 3000n,
  imageCostMicros: 7000n,
  enabled: true,
};

describe("ModelConfigService", () => {
  it("returns a JSON-safe public DTO without encrypted key material", async () => {
    const service = new ModelConfigService({
      modelConfig: {
        findMany: async () => [record],
        findFirst: async () => record,
        create: async () => record,
      },
    } as never);

    const [dto] = await service.list();

    expect(dto).toMatchObject({
      id: "model-1",
      hasApiKey: true,
      inputCostMicros: "1500",
      outputCostMicros: "3000",
      imageCostMicros: "7000",
    });
    expect(dto).not.toHaveProperty("apiKeyCiphertext");
    expect(JSON.stringify(dto)).toContain('"inputCostMicros":"1500"');
  });

  it("disables the existing active configuration in the same transaction before enabling a replacement", async () => {
    const updates: unknown[] = [];
    const created: unknown[] = [];
    const transaction = {
      $executeRawUnsafe: async () => undefined,
      modelConfig: {
        updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
        create: async (args: { data: unknown }) => { created.push(args); return record; },
      },
    };
    const service = new ModelConfigService({
      modelConfig: {
        findMany: async () => [],
        findFirst: async () => record,
        create: transaction.modelConfig.create,
      },
      $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    } as never, () => Buffer.alloc(32, 1));

    await service.create({
      provider: "OPENAI",
      endpointUrl: "https://models.example.test/v1",
      apiKey: "secret",
      modelName: "replacement",
      capabilities: "TEXT",
      visionEnabled: false,
      timeoutMs: 30_000,
      maxOutputTokens: 1024,
      temperature: "0.2",
      inputCostMicros: 1500,
      outputCostMicros: 3000,
      imageCostMicros: 0,
      enabled: true,
    }, "admin-1");

    expect(updates).toEqual([{ where: { enabled: true }, data: { enabled: false } }]);
    expect(created).toHaveLength(1);
  });

  it("serializes concurrent enabled configuration creation with a transaction advisory lock", async () => {
    let activeCount = 0;
    let maximumActiveCount = 0;
    let locked = false;
    const waiters: Array<() => void> = [];
    const lockCalls: unknown[][] = [];
    const database = {
      modelConfig: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async () => record,
        updateMany: async () => ({ count: 0 }),
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        let ownsLock = false;
        const tx = {
          $executeRawUnsafe: async (...args: unknown[]) => {
            lockCalls.push(args);
            if (locked) await new Promise<void>((resolve) => waiters.push(resolve));
            locked = true;
            ownsLock = true;
          },
          modelConfig: {
            updateMany: async () => { activeCount = 0; return { count: 0 }; },
            create: async () => {
              await Promise.resolve();
              activeCount += 1;
              maximumActiveCount = Math.max(maximumActiveCount, activeCount);
              return record;
            },
          },
        };
        try {
          return await callback(tx);
        } finally {
          if (ownsLock) {
            locked = false;
            waiters.shift()?.();
          }
        }
      },
    };
    const service = new ModelConfigService(database as never, () => Buffer.alloc(32, 1));
    const input = {
      provider: "OPENAI" as const,
      endpointUrl: "https://models.example.test/v1",
      apiKey: "secret",
      modelName: "replacement",
      capabilities: "TEXT" as const,
      visionEnabled: false,
      timeoutMs: 30_000,
      maxOutputTokens: 1024,
      temperature: "0.2",
      inputCostMicros: 1500,
      outputCostMicros: 3000,
      imageCostMicros: 0,
      enabled: true,
    };

    const differentTupleInput = {
      ...input,
      provider: "AZURE_OPENAI" as const,
      modelName: "replacement-vision",
      capabilities: "VISION" as const,
      visionEnabled: true,
    };
    await Promise.all([service.create(input, "admin-1"), service.create(differentTupleInput, "admin-2")]);

    expect(lockCalls).toEqual([
      ["SELECT pg_advisory_xact_lock($1)", expect.any(Number)],
      ["SELECT pg_advisory_xact_lock($1)", expect.any(Number)],
    ]);
    expect(lockCalls[0]?.[1]).toBe(lockCalls[1]?.[1]);
    expect(maximumActiveCount).toBe(1);
  });

  it("uses updatedAt and id descending as a stable enabled-config resolver order", async () => {
    let query: unknown;
    const resolver = new ModelConfigGatewayConfigResolver({
      modelConfig: {
        findMany: async () => [],
        findFirst: async (args: unknown) => { query = args; return null; },
        create: async () => record,
        updateMany: async () => ({ count: 0 }),
      },
      $transaction: async () => record,
    } as never);

    await resolver.getEnabled();

    expect(query).toEqual({
      where: { enabled: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
  });
});

import { prisma } from "../db/client";
import { decryptApiKey, encryptApiKey, modelKeyEncryptionKey, type EncryptedApiKey } from "./crypto";

export type ModelProvider = "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC" | "OTHER";
export type ModelCapability = "TEXT" | "VISION" | "EMBEDDING";
const ACTIVE_MODEL_CONFIG_LOCK_KEY = 1_947_812_340;

export type ModelConfigRecord = {
  id: string;
  provider: ModelProvider;
  endpointUrl: string;
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyTag: string;
  modelName: string;
  capabilities: ModelCapability;
  visionEnabled: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: string | number;
  inputCostMicros: bigint;
  outputCostMicros: bigint;
  imageCostMicros: bigint;
  enabled: boolean;
};

export type ModelConfigDto = Omit<
  ModelConfigRecord,
  "apiKeyCiphertext" | "apiKeyIv" | "apiKeyTag" | "inputCostMicros" | "outputCostMicros" | "imageCostMicros"
> & {
  hasApiKey: boolean;
  inputCostMicros: string;
  outputCostMicros: string;
  imageCostMicros: string;
};
export type ModelConfigInput = Omit<ModelConfigDto, "id" | "hasApiKey" | "inputCostMicros" | "outputCostMicros" | "imageCostMicros"> & {
  apiKey: string;
  inputCostMicros: number | bigint;
  outputCostMicros: number | bigint;
  imageCostMicros: number | bigint;
};

export interface ModelConfigDatabase {
  modelConfig: {
    findMany(args?: { orderBy?: { createdAt: "desc" } }): Promise<ModelConfigRecord[]>;
    findFirst(args: {
      where: { enabled: boolean };
      orderBy?: Array<{ updatedAt: "desc" } | { id: "desc" }>;
    }): Promise<ModelConfigRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<ModelConfigRecord>;
    updateMany(args: { where: { enabled: boolean }; data: { enabled: boolean } }): Promise<{ count: number }>;
  };
  $transaction<T>(callback: (tx: ModelConfigTransaction) => Promise<T>): Promise<T>;
}

type ModelConfigTransaction = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  modelConfig: Pick<ModelConfigDatabase["modelConfig"], "create" | "updateMany">;
};

export class ModelConfigService {
  constructor(
    private readonly database: ModelConfigDatabase = prisma as unknown as ModelConfigDatabase,
    private readonly encryptionKey: () => Buffer = modelKeyEncryptionKey,
  ) {}

  async list(): Promise<ModelConfigDto[]> {
    return (await this.database.modelConfig.findMany({ orderBy: { createdAt: "desc" } })).map(toDto);
  }

  async create(input: ModelConfigInput, createdByAdminId: string): Promise<ModelConfigDto> {
    const encrypted = encryptApiKey(input.apiKey, this.encryptionKey());
    const { apiKey: _apiKey, ...safeInput } = input;
    return toDto(await this.database.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1)", ACTIVE_MODEL_CONFIG_LOCK_KEY);
      if (input.enabled) await tx.modelConfig.updateMany({ where: { enabled: true }, data: { enabled: false } });
      return tx.modelConfig.create({
        data: {
          ...safeInput,
          inputCostMicros: BigInt(input.inputCostMicros),
          outputCostMicros: BigInt(input.outputCostMicros),
          imageCostMicros: BigInt(input.imageCostMicros),
          ...toDatabaseEnvelope(encrypted),
          createdByAdminId,
        },
      });
    }));
  }

}

export class ModelConfigGatewayConfigResolver {
  constructor(
    private readonly database: ModelConfigDatabase = prisma as unknown as ModelConfigDatabase,
    private readonly encryptionKey: () => Buffer = modelKeyEncryptionKey,
  ) {}

  async getEnabled(): Promise<import("./openai-gateway").ModelGatewayConfig | null> {
    const record = await this.database.modelConfig.findFirst({
      where: { enabled: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    if (!record) return null;
    return { ...record, temperature: String(record.temperature), apiKey: decryptApiKey({
      ciphertext: record.apiKeyCiphertext,
      iv: record.apiKeyIv,
      tag: record.apiKeyTag,
    }, this.encryptionKey()) };
  }
}

function toDatabaseEnvelope(envelope: EncryptedApiKey) {
  return { apiKeyCiphertext: envelope.ciphertext, apiKeyIv: envelope.iv, apiKeyTag: envelope.tag };
}

function toDto(record: ModelConfigRecord): ModelConfigDto {
  const {
    apiKeyCiphertext,
    apiKeyIv,
    apiKeyTag,
    inputCostMicros,
    outputCostMicros,
    imageCostMicros,
    ...safe
  } = record;
  return {
    ...safe,
    hasApiKey: Boolean(apiKeyCiphertext && apiKeyIv && apiKeyTag),
    inputCostMicros: inputCostMicros.toString(),
    outputCostMicros: outputCostMicros.toString(),
    imageCostMicros: imageCostMicros.toString(),
  };
}

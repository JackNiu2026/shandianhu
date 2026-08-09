import { ModelCapability, ModelProvider, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.adminUser.upsert({
    where: { email: "admin@lightning-tiger.local" },
    update: {},
    create: {
      email: "admin@lightning-tiger.local",
      passwordHash: "replace-before-production",
      role: "SUPERADMIN",
    },
  });

  await prisma.modelConfig.upsert({
    where: {
      provider_modelName_capabilities: {
        provider: ModelProvider.OPENAI,
        modelName: "gpt-5-mini",
        capabilities: ModelCapability.TEXT,
      },
    },
    update: { enabled: false },
    create: {
      provider: ModelProvider.OPENAI,
      endpointUrl: "https://gateway.invalid/openai",
      apiKeyCiphertext: "placeholder-ciphertext",
      apiKeyIv: "placeholder-iv",
      apiKeyTag: "placeholder-tag",
      modelName: "gpt-5-mini",
      capabilities: ModelCapability.TEXT,
      enabled: false,
    },
  });
} finally {
  await prisma.$disconnect();
}

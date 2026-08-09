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
      provider_model_capability: {
        provider: ModelProvider.OPENAI,
        model: "gpt-5-mini",
        capability: ModelCapability.TEXT,
      },
    },
    update: { isActive: true },
    create: {
      provider: ModelProvider.OPENAI,
      model: "gpt-5-mini",
      capability: ModelCapability.TEXT,
    },
  });
} finally {
  await prisma.$disconnect();
}

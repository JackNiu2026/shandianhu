import { AssessmentType, AssessmentVersionStatus, ModelCapability, ModelProvider, PrismaClient } from "@prisma/client";

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

  const definition = await prisma.assessmentDefinition.upsert({
    where: { slug: "learning-style" },
    update: {},
    create: {
      slug: "learning-style",
      name: "28题学习风格测评",
      description: "教学偏好参考，不是心理诊断或能力评价",
      enabled: true,
    },
  });

  await prisma.assessmentVersion.upsert({
    where: { assessmentDefinitionId_version: { assessmentDefinitionId: definition.id, version: 1 } },
    update: {},
    create: {
      assessmentDefinitionId: definition.id,
      version: 1,
      checksum: "learning-style-v1-28-question-deterministic",
      type: AssessmentType.DIAGNOSTIC,
      status: AssessmentVersionStatus.PUBLISHED,
      specification: {
        version: "learning-style-v1",
        questionIds: Array.from({ length: 28 }, (_, index) => `q${index + 1}`),
        legalOptions: ["A", "B"],
      },
      configuration: {
        scorer: "deterministic-learning-style-v1",
        dimensions: ["interaction", "information", "decision", "rhythm"],
      },
      publishedAt: new Date(),
    },
  });
} finally {
  await prisma.$disconnect();
}

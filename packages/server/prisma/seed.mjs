import { createHash } from "node:crypto";
import { AssessmentType, AssessmentVersionStatus, ModelCapability, ModelProvider, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const learningStyleConfiguration = {
  version: "learning-style-v1",
  legalOptions: ["A", "B"],
  questionRules: Array.from({ length: 28 }, (_, index) => ({
    id: `q${index + 1}`,
    dimension: ["EI", "SN", "TF", "JP"][Math.floor(index / 7)],
    options: index < 7 ? ["E", "I"] : index < 14 ? ["S", "N"] : index < 21 ? ["T", "F"] : ["J", "P"],
  })),
  scorer: "deterministic-learning-style-v1",
};
const learningStyleChecksum = createHash("sha256").update(JSON.stringify(learningStyleConfiguration)).digest("hex");

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
      checksum: learningStyleChecksum,
      type: AssessmentType.DIAGNOSTIC,
      status: AssessmentVersionStatus.PUBLISHED,
      specification: learningStyleConfiguration,
      configuration: learningStyleConfiguration,
      publishedAt: new Date(),
    },
  });
} finally {
  await prisma.$disconnect();
}

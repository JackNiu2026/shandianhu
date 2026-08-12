import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { AssessmentType, AssessmentVersionStatus, ModelCapability, ModelProvider, PrismaClient } from "@prisma/client";
import { AGENT_CATALOG } from "../src/agents/catalog.js";

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

// 错题诊断测评配置（V2.1）：视觉模型分析 K12 错题图片，输出结构化诊断
const wrongQuestionConfiguration = {
  version: "wrong-question-v1",
  imageLimits: { min: 1, max: 9 },
  artifactKind: "SOURCE_IMAGE",
  analyzer: "vision-wrong-question-v1",
};
const wrongQuestionChecksum = createHash("sha256").update(JSON.stringify(wrongQuestionConfiguration)).digest("hex");

// 管理员密码：优先从 ADMIN_PASSWORD 环境变量读取，缺省回退到开发占位口令并告警
const adminPassword = process.env.ADMIN_PASSWORD;
if (process.env.NODE_ENV === "production" && (!adminPassword || adminPassword.length < 12)) {
  throw new Error("ADMIN_PASSWORD must be at least 12 characters in production");
}
if (!adminPassword) {
  console.warn("[seed] ADMIN_PASSWORD 未设置，使用开发占位口令 \"admin123\"。生产环境务必通过环境变量配置。");
}
const passwordHash = bcrypt.hash(adminPassword || "admin123", 10);

try {
  await prisma.adminUser.upsert({
    where: { email: "admin@lightning-tiger.local" },
    update: {},
    create: {
      email: "admin@lightning-tiger.local",
      passwordHash: await passwordHash,
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

  const learningStyleDefinition = await prisma.assessmentDefinition.upsert({
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
    where: { assessmentDefinitionId_version: { assessmentDefinitionId: learningStyleDefinition.id, version: 1 } },
    update: {},
    create: {
      assessmentDefinitionId: learningStyleDefinition.id,
      version: 1,
      checksum: learningStyleChecksum,
      type: AssessmentType.DIAGNOSTIC,
      status: AssessmentVersionStatus.PUBLISHED,
      specification: learningStyleConfiguration,
      configuration: learningStyleConfiguration,
      publishedAt: new Date(),
    },
  });

  // 错题诊断测评定义（V2.1 必需，否则 WrongQuestionService 运行时 NOT_FOUND）
  const wrongQuestionDefinition = await prisma.assessmentDefinition.upsert({
    where: { slug: "wrong-question" },
    update: {},
    create: {
      slug: "wrong-question",
      name: "错题图片诊断",
      description: "上传错题图片，由视觉模型生成结构化诊断与学习证据",
      enabled: true,
    },
  });

  await prisma.assessmentVersion.upsert({
    where: { assessmentDefinitionId_version: { assessmentDefinitionId: wrongQuestionDefinition.id, version: 1 } },
    update: {},
    create: {
      assessmentDefinitionId: wrongQuestionDefinition.id,
      version: 1,
      checksum: wrongQuestionChecksum,
      type: AssessmentType.DIAGNOSTIC,
      status: AssessmentVersionStatus.PUBLISHED,
      specification: wrongQuestionConfiguration,
      configuration: wrongQuestionConfiguration,
      publishedAt: new Date(),
    },
  });

  // V2.2：初始化 13 个学科/学段智能体槽位（全部 DISABLED，不填提示词、不配置模型）
  for (const [subject, schoolStage] of AGENT_CATALOG) {
    await prisma.agentConfig.upsert({
      where: { subject_schoolStage: { subject, schoolStage } },
      update: {},
      create: { subject, schoolStage, status: "DISABLED" },
    });
  }
  console.log(`[seed] 已初始化 ${AGENT_CATALOG.length} 个学科智能体槽位（全部 DISABLED）`);
} finally {
  await prisma.$disconnect();
}

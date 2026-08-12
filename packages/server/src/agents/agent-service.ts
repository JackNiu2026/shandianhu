import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { AGENT_CATALOG, isApprovedAgent, stageForGrade, type SchoolStageCode, type SubjectCode } from "./catalog";

export type AgentConfigRecord = {
  id: string;
  subject: SubjectCode;
  schoolStage: SchoolStageCode;
  status: "ENABLED" | "DISABLED";
  publishedPromptVersionId: string | null;
  primaryModelConfigId: string | null;
  fallbackModelConfigId: string | null;
  temperature: number;
  maxOutputTokens: number;
  updatedByAdminId: string | null;
};

export type AgentWithPrompt = AgentConfigRecord & {
  publishedPromptVersion: { id: string; sequence: number; content: string; checksum: string } | null;
};

export interface AgentDatabase {
  agentConfig: {
    findUnique(args: {
      where: { id: string } | { subject_schoolStage: { subject: SubjectCode; schoolStage: SchoolStageCode } };
      include?: unknown;
    }): Promise<AgentWithPrompt | null>;
    findMany(args: {
      where?: { schoolStage?: SchoolStageCode; status?: "ENABLED" | "DISABLED" };
      include?: unknown;
      orderBy?: unknown;
    }): Promise<AgentWithPrompt[]>;
    upsert(args: {
      where: { subject_schoolStage: { subject: SubjectCode; schoolStage: SchoolStageCode } };
      create: { subject: SubjectCode; schoolStage: SchoolStageCode };
      update: Record<string, never>;
    }): Promise<AgentConfigRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<AgentConfigRecord, "status" | "primaryModelConfigId" | "fallbackModelConfigId" | "temperature" | "maxOutputTokens" | "publishedPromptVersionId" | "updatedByAdminId">>;
    }): Promise<AgentConfigRecord>;
  };
}

/**
 * 验证智能体可用于创建会话：
 * 1. 存在且状态为 ENABLED
 * 2. 已发布提示词
 * 3. 配置了主模型
 */
export function assertAgentUsable(agent: AgentWithPrompt | null): asserts agent is AgentWithPrompt & {
  publishedPromptVersion: { id: string; sequence: number };
  primaryModelConfigId: string;
} {
  if (!agent) {
    throw new AppError("NOT_FOUND", 404, "Agent not found for this subject and stage");
  }
  if (agent.status !== "ENABLED") {
    throw new AppError("FORBIDDEN", 403, "Agent is not enabled");
  }
  if (!agent.publishedPromptVersion) {
    throw new AppError("RESOURCE_CONFLICT", 409, "Agent has no published prompt version");
  }
  if (!agent.primaryModelConfigId) {
    throw new AppError("RESOURCE_CONFLICT", 409, "Agent has no primary model configured");
  }
}

export class AgentService {
  constructor(private readonly database: AgentDatabase = prisma as unknown as AgentDatabase) {}

  /**
   * 按学科和学段查找智能体（含已发布提示词）。
   */
  async findBySubjectStage(subject: SubjectCode, schoolStage: SchoolStageCode): Promise<AgentWithPrompt | null> {
    if (!isApprovedAgent(subject, schoolStage)) {
      throw new AppError("NOT_FOUND", 404, `No approved agent for ${subject}/${schoolStage}`);
    }
    return this.database.agentConfig.findUnique({
      where: { subject_schoolStage: { subject, schoolStage } },
      include: { publishedPromptVersion: { select: { id: true, sequence: true, content: true, checksum: true } } },
    });
  }

  /**
   * 按 ID 查找智能体（含已发布提示词）。
   */
  async findById(agentId: string): Promise<AgentWithPrompt | null> {
    return this.database.agentConfig.findUnique({
      where: { id: agentId },
      include: { publishedPromptVersion: { select: { id: true, sequence: true, content: true, checksum: true } } },
    });
  }

  /**
   * 列出所有智能体（含已发布提示词信息），按学科排序。
   */
  async listAll(): Promise<AgentWithPrompt[]> {
    return this.database.agentConfig.findMany({
      orderBy: { subject: "asc" },
      include: { publishedPromptVersion: { select: { id: true, sequence: true, content: true, checksum: true } } },
    });
  }

  /**
   * 更新智能体配置（模型、温度等），并记录操作者。
   */
  async updateConfig(
    agentId: string,
    config: Partial<Pick<AgentConfigRecord, "primaryModelConfigId" | "fallbackModelConfigId" | "temperature" | "maxOutputTokens">>,
    adminUserId: string,
  ): Promise<AgentConfigRecord> {
    return this.database.agentConfig.update({
      where: { id: agentId },
      data: { ...config, updatedByAdminId: adminUserId },
    });
  }

  /**
   * 返回指定学段的所有智能体（含已发布提示词信息）。
   * 可通过 status 过滤。
   */
  async listByStage(schoolStage: SchoolStageCode, status?: "ENABLED" | "DISABLED"): Promise<AgentWithPrompt[]> {
    return this.database.agentConfig.findMany({
      where: { schoolStage, ...(status ? { status } : {}) },
      include: { publishedPromptVersion: { select: { id: true, sequence: true, content: true, checksum: true } } },
      orderBy: { subject: "asc" },
    });
  }

  /**
   * 按年级解析可用智能体列表。
   * 年级无效时返回空数组。
   */
  async listForGrade(grade: string | null, status?: "ENABLED" | "DISABLED"): Promise<AgentWithPrompt[]> {
    const stage = stageForGrade(grade);
    if (!stage) return [];
    return this.listByStage(stage, status);
  }

  /**
   * 更新智能体状态（启用/停用），并记录操作者。
   */
  async setStatus(agentId: string, status: "ENABLED" | "DISABLED", adminUserId?: string): Promise<AgentConfigRecord> {
    return this.database.agentConfig.update({
      where: { id: agentId },
      data: { status, ...(adminUserId ? { updatedByAdminId: adminUserId } : {}) },
    });
  }

  /**
   * 更新智能体模型配置。
   */
  async setModels(
    agentId: string,
    config: Partial<Pick<AgentConfigRecord, "primaryModelConfigId" | "fallbackModelConfigId" | "temperature" | "maxOutputTokens">>,
  ): Promise<AgentConfigRecord> {
    return this.database.agentConfig.update({
      where: { id: agentId },
      data: config,
    });
  }
}

/**
 * 返回完整目录（用于 seed 和校验）。
 */
export function getCatalog(): ReadonlyArray<readonly [SubjectCode, SchoolStageCode]> {
  return AGENT_CATALOG;
}

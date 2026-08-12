import { createHash } from "node:crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import type { SubjectCode, SchoolStageCode } from "./catalog";

const MAX_PROMPT_BYTES = 200 * 1024; // 200 KiB

export type PromptStatus = "DRAFT" | "TESTING" | "TESTED" | "PUBLISHED" | "SUPERSEDED";

export type PromptVersionRecord = {
  id: string;
  agentId: string;
  sequence: number;
  content: string;
  checksum: string;
  status: PromptStatus;
  createdById: string;
  publishedAt: Date | null;
  supersedesId: string | null;
  createdAt: Date;
};

export type AgentConfigSummary = {
  id: string;
  subject: SubjectCode;
  schoolStage: SchoolStageCode;
  publishedPromptVersionId: string | null;
};

export interface PromptDatabase {
  agentPromptVersion: {
    findMany(args: {
      where: { agentId: string };
      orderBy: { sequence: "desc" | "asc" };
    }): Promise<PromptVersionRecord[]>;
    findUnique(args: {
      where: { id: string };
    }): Promise<PromptVersionRecord | null>;
    findUniqueByAgentSequence?(args: {
      where: { agentId_sequence: { agentId: string; sequence: number } };
    }): Promise<PromptVersionRecord | null>;
    create(args: {
      data: {
        agentId: string;
        sequence: number;
        content: string;
        checksum: string;
        status: PromptStatus;
        createdById: string;
        supersedesId: string | null;
      };
    }): Promise<PromptVersionRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<PromptVersionRecord, "content" | "checksum" | "status" | "publishedAt">>;
    }): Promise<PromptVersionRecord>;
    count(args: { where: { agentId: string } }): Promise<number>;
    aggregate(args: {
      where: { agentId: string };
      _max: { sequence: true };
    }): Promise<{ _max: { sequence: number | null } }>;
  };
  agentConfig: {
    findUnique(args: {
      where: { id: string };
    }): Promise<AgentConfigSummary | null>;
    update(args: {
      where: { id: string };
      data: { publishedPromptVersionId: string | null };
    }): Promise<unknown>;
  };
  agentPromptTest: {
    create(args: {
      data: {
        promptVersionId: string;
        modelUsageLedgerId: string;
        createdById: string | null;
        status: PromptStatus;
        passed: boolean;
        inputPreview: string | null;
        outputPreview: string | null;
      };
    }): Promise<{ id: string }>;
  };
  $transaction<T>(operation: (tx: PromptTransactionClient) => Promise<T>): Promise<T>;
}

type PromptTransactionClient = {
  agentPromptVersion: {
    updateMany(args: {
      where: { agentId: string; status: PromptStatus };
      data: { status: PromptStatus };
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<PromptVersionRecord, "status" | "publishedAt">>;
    }): Promise<PromptVersionRecord>;
  };
  agentConfig: {
    update(args: {
      where: { id: string };
      data: { publishedPromptVersionId: string };
    }): Promise<unknown>;
  };
};

export type AdminContext = { adminUserId: string; requestId: string };

function normalizeContent(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function computeChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function truncatePreview(text: string, maxLen = 500): string {
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

export class PromptService {
  constructor(private readonly database: PromptDatabase = prisma as unknown as PromptDatabase) {}

  /**
   * 创建新的 DRAFT 提示词版本。
   * - 内容规范化换行，计算 SHA-256
   * - sequence = max(existing) + 1
   * - 不修改历史版本
   */
  async createDraft(agentId: string, rawContent: string, ctx: AdminContext): Promise<PromptVersionRecord> {
    await this.assertAgentExists(agentId);

    const content = normalizeContent(rawContent);
    if (content.length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt content cannot be empty");
    }
    if (Buffer.byteLength(content, "utf8") > MAX_PROMPT_BYTES) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt content exceeds 200 KiB limit");
    }

    const aggregate = await this.database.agentPromptVersion.aggregate({
      where: { agentId },
      _max: { sequence: true },
    });
    const nextSequence = (aggregate._max.sequence ?? 0) + 1;
    const checksum = computeChecksum(content);

    return this.database.agentPromptVersion.create({
      data: {
        agentId,
        sequence: nextSequence,
        content,
        checksum,
        status: "DRAFT",
        createdById: ctx.adminUserId,
        supersedesId: null,
      },
    });
  }

  /**
   * 更新 DRAFT 版本的内容（仅 DRAFT 状态可更新）。
   * 已测试或已发布的版本不可修改。
   */
  async updateContent(versionId: string, rawContent: string, _ctx: AdminContext): Promise<PromptVersionRecord> {
    const version = await this.getVersionOrThrow(versionId);
    if (version.status !== "DRAFT") {
      throw new AppError("RESOURCE_CONFLICT", 409, `Cannot modify prompt version in ${version.status} status`);
    }

    const content = normalizeContent(rawContent);
    if (content.length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt content cannot be empty");
    }
    if (Buffer.byteLength(content, "utf8") > MAX_PROMPT_BYTES) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt content exceeds 200 KiB limit");
    }

    return this.database.agentPromptVersion.update({
      where: { id: versionId },
      data: { content, checksum: computeChecksum(content) },
    });
  }

  /**
   * 列出智能体的所有提示词版本（按 sequence 倒序）。
   */
  async listVersions(agentId: string): Promise<PromptVersionRecord[]> {
    return this.database.agentPromptVersion.findMany({
      where: { agentId },
      orderBy: { sequence: "desc" },
    });
  }

  /**
   * 获取单个提示词版本（不存在时抛出 NOT_FOUND）。
   */
  async getVersion(versionId: string): Promise<PromptVersionRecord> {
    return this.getVersionOrThrow(versionId);
  }

  /**
   * 记录一次成功的提示词测试，将版本状态从 DRAFT/TESTING 变为 TESTED。
   */
  async recordSuccessfulTest(versionId: string, modelCallId: string, ctx: AdminContext): Promise<PromptVersionRecord> {
    const version = await this.getVersionOrThrow(versionId);
    if (version.status !== "DRAFT" && version.status !== "TESTING") {
      throw new AppError("RESOURCE_CONFLICT", 409, `Cannot test prompt version in ${version.status} status`);
    }

    await this.database.agentPromptTest.create({
      data: {
        promptVersionId: versionId,
        modelUsageLedgerId: modelCallId,
        createdById: ctx.adminUserId,
        status: "TESTED",
        passed: true,
        inputPreview: truncatePreview(version.content.slice(0, 200)),
        outputPreview: null,
      },
    });

    return this.database.agentPromptVersion.update({
      where: { id: versionId },
      data: { status: "TESTED" },
    });
  }

  /**
   * 记录一次失败的提示词测试，版本保持 DRAFT 状态。
   */
  async recordFailedTest(
    versionId: string,
    modelCallId: string,
    ctx: AdminContext,
    errorOutput: string,
  ): Promise<PromptVersionRecord> {
    const version = await this.getVersionOrThrow(versionId);
    if (version.status !== "DRAFT" && version.status !== "TESTING") {
      throw new AppError("RESOURCE_CONFLICT", 409, `Cannot test prompt version in ${version.status} status`);
    }

    await this.database.agentPromptTest.create({
      data: {
        promptVersionId: versionId,
        modelUsageLedgerId: modelCallId,
        createdById: ctx.adminUserId,
        status: "TESTING",
        passed: false,
        inputPreview: truncatePreview(version.content.slice(0, 200)),
        outputPreview: truncatePreview(errorOutput),
      },
    });

    return this.database.agentPromptVersion.update({
      where: { id: versionId },
      data: { status: "DRAFT" },
    });
  }

  /**
   * 原子发布：旧 PUBLISHED → SUPERSEDED，新版本 → PUBLISHED，更新 AgentConfig.publishedPromptVersionId。
   * 仅 TESTED 版本可发布。
   */
  async publish(agentId: string, versionId: string, _ctx: AdminContext): Promise<PromptVersionRecord> {
    const agent = await this.assertAgentExists(agentId);
    const version = await this.getVersionOrThrow(versionId);
    if (version.agentId !== agentId) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt version does not belong to this agent");
    }
    if (version.status !== "TESTED") {
      throw new AppError("RESOURCE_CONFLICT", 409, `Cannot publish prompt version in ${version.status} status (requires TESTED)`);
    }

    const now = new Date();
    return this.database.$transaction(async (tx) => {
      // 将旧的 PUBLISHED 版本设为 SUPERSEDED
      await tx.agentPromptVersion.updateMany({
        where: { agentId, status: "PUBLISHED" },
        data: { status: "SUPERSEDED" },
      });
      // 发布新版本
      const published = await tx.agentPromptVersion.update({
        where: { id: versionId },
        data: { status: "PUBLISHED", publishedAt: now },
      });
      // 更新智能体配置指向新版本
      await tx.agentConfig.update({
        where: { id: agent.id },
        data: { publishedPromptVersionId: versionId },
      });
      return published;
    });
  }

  /**
   * 回滚：不修改历史版本，而是复制目标版本内容创建新的 DRAFT。
   * 调用方需完成测试后再发布。
   */
  async rollback(agentId: string, targetVersionId: string, ctx: AdminContext): Promise<PromptVersionRecord> {
    await this.assertAgentExists(agentId);
    const target = await this.getVersionOrThrow(targetVersionId);
    if (target.agentId !== agentId) {
      throw new AppError("VALIDATION_ERROR", 400, "Target version does not belong to this agent");
    }
    if (target.status === "DRAFT" || target.status === "TESTING") {
      throw new AppError("RESOURCE_CONFLICT", 409, "Can only rollback to a previously published or superseded version");
    }

    return this.createDraft(agentId, target.content, ctx);
  }

  private async assertAgentExists(agentId: string): Promise<AgentConfigSummary> {
    const agent = await this.database.agentConfig.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new AppError("NOT_FOUND", 404, "Agent not found");
    }
    return agent;
  }

  private async getVersionOrThrow(versionId: string): Promise<PromptVersionRecord> {
    const version = await this.database.agentPromptVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new AppError("NOT_FOUND", 404, "Prompt version not found");
    }
    return version;
  }
}

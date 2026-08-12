/**
 * V2.2 辅导会话服务
 *
 * 关键约束：
 * - 会话创建时固化 agentId + promptVersionId，确保后续对话延续同一教学策略版本；
 *   新发布的 prompt 仅影响新会话，不污染既有对话。
 * - childId 必须属于请求用户 parentProfileId，跨家庭操作抛 FORBIDDEN。
 * - 智能体必须 ENABLED、已发布 prompt、配置了有效主模型。
 * - 会话按 lastActivityAt 降序列表。
 */
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { AgentService, assertAgentUsable, type AgentWithPrompt } from "../agents/agent-service";
import { stageForGrade, type SchoolStageCode, type SubjectCode } from "../agents/catalog";

// ─── 类型定义 ──────────────────────────────────────────────

export type ConversationRecord = {
  id: string;
  childId: string;
  agentId: string;
  promptVersionId: string;
  status: "ACTIVE" | "ARCHIVED";
  title: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface ConversationDatabase {
  tutorConversation: {
    findUnique(args: { where: { id: string } }): Promise<(ConversationRecord & {
      promptVersion: { agentId: string; id: string; sequence: number; content: string };
      agent: { subject: SubjectCode; schoolStage: SchoolStageCode; id: string };
    }) | null>;
    findMany(args: {
      where: { childId?: string; agentId?: string; status?: "ACTIVE" | "ARCHIVED" };
      orderBy: { lastActivityAt: "desc" };
      take?: number;
    }): Promise<ConversationRecord[]>;
    create(args: {
      data: {
        childId: string;
        agentId: string;
        promptVersionId: string;
        title?: string | null;
      };
    }): Promise<ConversationRecord>;
    update(args: {
      where: { id: string };
      data: { status?: "ACTIVE" | "ARCHIVED"; title?: string | null; lastActivityAt: Date };
    }): Promise<ConversationRecord>;
  };
  parentProfile: {
    findUnique(args: {
      where: { id: string };
      include?: { children: { where: { id: { equals: string } }; select: { id: true; grade: true } } };
    }): Promise<{
      id: string;
      children: Array<{ id: string; grade: string | null }>;
    } | null>;
  };
  child: {
    findUnique(args: { where: { id: string }; select?: unknown }): Promise<{ id: string; grade: string | null } | null>;
  };
}

// ─── 服务实现 ──────────────────────────────────────────────

export type CreateConversationInput = {
  parentProfileId: string;
  childId: string;
  subject: SubjectCode;
  title?: string | null;
};

export type ConversationWithAgent = ConversationRecord & {
  subject: SubjectCode;
  schoolStage: SchoolStageCode;
  promptVersionSequence: number;
};

export class ConversationService {
  constructor(
    private readonly database: ConversationDatabase = prisma as unknown as ConversationDatabase,
    private readonly agents: AgentService = new AgentService(),
  ) {}

  /**
   * 创建新会话：
   * - 按 childId 校验归属和年级，查学段 → 解析学科智能体
   * - 智能体必须 ENABLED + 已发布 prompt
   * - 固化 agentId + promptVersionId（后续继续会话不会漂移到新版本）
   */
  async create(input: CreateConversationInput): Promise<ConversationWithAgent> {
    const { child, stage } = await this.assertChildInFamily(input.parentProfileId, input.childId);
    const agent = await this.agents.findBySubjectStage(input.subject, stage);
    // 断言并把类型收紧为可用
    assertAgentUsable(agent);
    const usableAgent = agent as AgentWithPrompt & {
      publishedPromptVersion: { id: string; sequence: number };
      primaryModelConfigId: string;
    };
    const record = await this.database.tutorConversation.create({
      data: {
        childId: input.childId,
        agentId: usableAgent.id,
        promptVersionId: usableAgent.publishedPromptVersion.id,
        title: input.title ?? null,
      },
    });
    return {
      ...record,
      subject: usableAgent.subject,
      schoolStage: usableAgent.schoolStage,
      promptVersionSequence: usableAgent.publishedPromptVersion.sequence,
    };
  }

  /** 按 ID 获取会话详情（含学科/学段/prompt 版本号） */
  async get(
    conversationId: string,
    viewerParentProfileId?: string,
  ): Promise<ConversationWithAgent> {
    const conv = await this.database.tutorConversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new AppError("NOT_FOUND", 404, "Conversation not found");
    if (viewerParentProfileId) {
      await this.assertChildInFamily(viewerParentProfileId, conv.childId);
    }
    return {
      ...conv,
      subject: conv.agent!.subject,
      schoolStage: conv.agent!.schoolStage,
      promptVersionSequence: conv.promptVersion!.sequence,
    };
  }

  /** 列出指定孩子的会话（默认 ACTIVE，按 lastActivityAt 倒序） */
  async listByChild(parentProfileId: string, childId: string, status?: "ACTIVE" | "ARCHIVED", limit = 50): Promise<ConversationWithAgent[]> {
    await this.assertChildInFamily(parentProfileId, childId);
    const rows = await this.database.tutorConversation.findMany({
      where: { childId, ...(status ? { status } : {}) },
      orderBy: { lastActivityAt: "desc" },
      take: limit,
    });
    // 拉 agent 信息
    const ids = [...new Set(rows.map((r) => r.agentId))];
    const agentById = new Map<string, AgentWithPrompt | null>();
    await Promise.all(ids.map(async (id) => agentById.set(id, await this.agents.findById(id))));
    return rows.map((r) => {
      const a = agentById.get(r.agentId);
      return {
        ...r,
        subject: (a?.subject ?? "MATH") as SubjectCode,
        schoolStage: (a?.schoolStage ?? "PRIMARY") as SchoolStageCode,
        promptVersionSequence: a?.publishedPromptVersion?.sequence ?? -1,
      };
    });
  }

  /** 更新会话 title/status，用于用户归档或修改首条标题 */
  async update(
    conversationId: string,
    patch: { status?: "ACTIVE" | "ARCHIVED"; title?: string | null },
    viewerParentProfileId?: string,
  ): Promise<ConversationRecord> {
    const existing = await this.database.tutorConversation.findUnique({ where: { id: conversationId } });
    if (!existing) throw new AppError("NOT_FOUND", 404, "Conversation not found");
    if (viewerParentProfileId) {
      await this.assertChildInFamily(viewerParentProfileId, existing.childId);
    }
    return this.database.tutorConversation.update({
      where: { id: conversationId },
      data: { ...patch, lastActivityAt: new Date() },
    });
  }

  // ─── 内部断言 ──────────────────────────────────────────

  private async assertChildInFamily(
    parentProfileId: string,
    childId: string,
  ): Promise<{ child: { id: string; grade: string | null }; stage: SchoolStageCode }> {
    const parent = await this.database.parentProfile.findUnique({
      where: { id: parentProfileId },
      include: { children: { where: { id: { equals: childId } }, select: { id: true, grade: true } } },
    });
    if (!parent || !parent.children || parent.children.length === 0) {
      throw new AppError("FORBIDDEN", 403, "Child is not in the parent family");
    }
    const child = parent.children[0];
    const stage = stageForGrade(child.grade);
    if (!stage) {
      throw new AppError("RESOURCE_CONFLICT", 409, "Child grade must be set before starting tutoring (1–12)");
    }
    return { child, stage };
  }
}

/**
 * V2.2 辅导消息 + 图片附件服务
 *
 * 幂等：
 * - 用户消息按 conversationId + clientMessageId 唯一；重试同一 clientMessageId 返回原消息。
 *
 * 图片附件规则：
 * - 每条 USER 消息允许 0–4 张图片附件。
 * - 附件引用 V2.1 FileObject（目的 TUTOR_INPUT，所属 childId 匹配）。
 * - 不保存临时签名 URL，只保存 fileObjectId 引用，消费时按需签名。
 *
 * 助手消息：流式生成时 PENDING → PARTIAL → COMPLETE/FAILED/CANCELLED；
 * stream-service 负责增量写入 content 和 modelCallId；generationStatus 不可回头。
 */
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

// ─── 类型 ──────────────────────────────────────────────────

export type MessageRecord = {
  id: string;
  conversationId: string;
  clientMessageId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  generationStatus: "PENDING" | "COMPLETE" | "PARTIAL" | "INTERRUPTED" | "FAILED" | "CANCELLED";
  modelCallId: string | null;
  sequence: number;
  createdAt: Date;
};

export type MessageAttachmentRecord = {
  id: string;
  messageId: string;
  fileObjectId: string;
  ordinal: number;
  createdAt: Date;
};

export type FileObjectHead = {
  id: string;
  childId: string | null;
  purpose: string;
  status: string;
};

export interface MessageDatabase {
  tutorMessage: {
    findUnique(args: {
      where: { conversationId_clientMessageId?: { conversationId: string; clientMessageId: string } };
    }): Promise<MessageRecord | null>;
    findFirst(args: {
      where: { conversationId: string };
      orderBy: { sequence: "desc" };
      select?: unknown;
    }): Promise<{ sequence: number } | null>;
    findMany(args: {
      where: { conversationId: string };
      orderBy: { sequence: "asc" };
      take?: number;
    }): Promise<(MessageRecord & { attachments: MessageAttachmentRecord[] })[]>;
    create(args: { data: Omit<MessageRecord, "id" | "createdAt"> }): Promise<MessageRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<MessageRecord, "content" | "generationStatus" | "modelCallId">>;
    }): Promise<MessageRecord>;
  };
  messageAttachment: {
    createMany(args: {
      data: Array<Omit<MessageAttachmentRecord, "id" | "createdAt">>;
    }): Promise<{ count: number }>;
  };
  fileObject: {
    findUnique(args: {
      where: { id: string };
      select?: unknown;
    }): Promise<FileObjectHead | null>;
  };
  tutorConversation: {
    findUnique(args: {
      where: { id: string };
      select?: { childId: true; id: true; agentId: true } | unknown;
    }): Promise<{ childId: string; id: string; agentId: string } | null>;
  };
}

export type AcceptedMessage = MessageRecord & {
  attachments: MessageAttachmentRecord[];
  sequence: number;
};

export type AcceptUserMessageInput = {
  conversationId: string;
  clientMessageId: string;
  content: string;
  /** 附件 fileObjectId 列表，最多 4 个且必须为该 child 的 TUTOR_INPUT 文件 */
  attachmentFileObjectIds?: string[];
  /** 用于权限检查：调用方传 parentProfileId 时校验 child 归属 */
  parentProfileId?: string;
};

const MAX_ATTACHMENTS = 4;

// ─── 服务实现 ──────────────────────────────────────────────

export class MessageService {
  constructor(
    private readonly database: MessageDatabase = prisma as unknown as MessageDatabase,
  ) {}

  /**
   * 接受一条用户消息（幂等，按 conversationId + clientMessageId）。
   *
   * 规则：
   * - 内容不能为空（可以只有图片没有文字，但空字符串且无附件会拒绝）。
   * - 图片 0–4 张，每张都必须是该 child 的 TUTOR_INPUT ACTIVE 文件。
   * - 首次写入时递增会话序列并创建附件；重复 clientMessageId 返回原消息。
   * - parentProfileId 非空时会校验会话的 child 是否属于该家长。
   */
  async accept(input: AcceptUserMessageInput): Promise<AcceptedMessage> {
    if (!input.clientMessageId) {
      throw new AppError("VALIDATION_ERROR", 400, "clientMessageId is required");
    }

    // 幂等快速路径
    const prior = await this.database.tutorMessage.findUnique({
      where: { conversationId_clientMessageId: {
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      } },
    });
    if (prior) return this.enrichAttachments(prior);

    const conv = await this.database.tutorConversation.findUnique({
      where: { id: input.conversationId },
    });
    if (!conv) throw new AppError("NOT_FOUND", 404, "Conversation not found");

    if (input.parentProfileId) {
      await this.assertChildInFamily(input.parentProfileId, conv.childId);
    }

    const attachmentIds = input.attachmentFileObjectIds ?? [];
    if (attachmentIds.length > MAX_ATTACHMENTS) {
      throw new AppError("VALIDATION_ERROR", 400, `At most ${MAX_ATTACHMENTS} attachments allowed per message`);
    }
    if (!input.content.trim() && attachmentIds.length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Message must have text content or at least one attachment");
    }

    // 校验附件：每张都是该 child 的 TUTOR_INPUT、ACTIVE
    await Promise.all(attachmentIds.map(async (foid) => {
      const file = await this.database.fileObject.findUnique({ where: { id: foid } });
      if (!file) throw new AppError("NOT_FOUND", 404, `Attachment file not found: ${foid}`);
      if (file.purpose !== "TUTOR_INPUT") {
        throw new AppError("VALIDATION_ERROR", 400, `Attachment must have purpose TUTOR_INPUT: ${foid}`);
      }
      if (file.status !== "ACTIVE") {
        throw new AppError("VALIDATION_ERROR", 400, `Attachment is not active: ${foid}`);
      }
      if (file.childId !== conv.childId) {
        throw new AppError("FORBIDDEN", 403, `Attachment does not belong to the child: ${foid}`);
      }
    }));

    const nextSequence = await this.nextSequenceFor(input.conversationId);
    const message = await this.database.tutorMessage.create({
      data: {
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        role: "USER",
        content: input.content,
        generationStatus: "COMPLETE",
        modelCallId: null,
        sequence: nextSequence,
      },
    });
    if (attachmentIds.length > 0) {
      await this.database.messageAttachment.createMany({
        data: attachmentIds.map((foid, i) => ({
          messageId: message.id,
          fileObjectId: foid,
          ordinal: i,
        })),
      });
    }
    return this.enrichAttachments(message);
  }

  /**
   * 创建助手消息（PENDING 状态）。调用处（stream-service）会流式增量写入 content，
   * 最终状态迁移到 COMPLETE/FAILED/CANCELLED。不接受 attachments。
   */
  async createAssistant(params: {
    conversationId: string;
    clientMessageId: string;
    sequence?: number;
  }): Promise<MessageRecord> {
    const seq = params.sequence ?? await this.nextSequenceFor(params.conversationId);
    try {
      return await this.database.tutorMessage.create({
        data: {
          conversationId: params.conversationId,
          clientMessageId: params.clientMessageId,
          role: "ASSISTANT",
          content: "",
          generationStatus: "PENDING",
          modelCallId: null,
          sequence: seq,
        },
      });
    } catch (error) {
      // 幂等：已存在相同 clientMessageId 则返回
      if (isUniqueViolation(error)) {
        const existing = await this.database.tutorMessage.findUnique({
          where: { conversationId_clientMessageId: {
            conversationId: params.conversationId,
            clientMessageId: params.clientMessageId,
          } },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * 流式写入助手内容：传入当前累积的完整文本（调用方保存缓冲区）。
   * - 至少设置 PARTIAL 状态
   * - 不截断：传入的完整文本必须等于或长于之前版本
   */
  async updateAssistantProgress(
    messageId: string,
    completeTextSoFar: string,
    opts: { modelCallId?: string } = {},
  ): Promise<MessageRecord> {
    return this.database.tutorMessage.update({
      where: { id: messageId },
      data: {
        content: completeTextSoFar,
        generationStatus: "PARTIAL",
        ...(opts.modelCallId !== undefined ? { modelCallId: opts.modelCallId } : {}),
      },
    });
  }

  /**
   * 最终化助手消息：设置状态，可选写入 modelCallId。
   * @param finalText 最终完整文本（如果不是 append 流式，可以这里一次性写回）
   */
  async finalizeAssistant(
    messageId: string,
    status: "COMPLETE" | "FAILED" | "CANCELLED" | "INTERRUPTED",
    extra: { finalText?: string; modelCallId?: string } = {},
  ): Promise<MessageRecord> {
    return this.database.tutorMessage.update({
      where: { id: messageId },
      data: {
        generationStatus: status,
        ...(extra.finalText !== undefined ? { content: extra.finalText } : {}),
        ...(extra.modelCallId !== undefined ? { modelCallId: extra.modelCallId } : {}),
      },
    });
  }

  /** 列出最近 N 条消息用于上下文组装（按 sequence 升序返回） */
  async listRecent(conversationId: string, take = 50): Promise<Array<MessageRecord & { attachments: MessageAttachmentRecord[] }>> {
    return this.database.tutorMessage.findMany({
      where: { conversationId },
      orderBy: { sequence: "asc" },
      take,
    });
  }

  // ─── 内部辅助 ──────────────────────────────────────────

  private async nextSequenceFor(conversationId: string): Promise<number> {
    const last = await this.database.tutorMessage.findFirst({
      where: { conversationId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return (last?.sequence ?? -1) + 1;
  }

  private async enrichAttachments(message: MessageRecord): Promise<AcceptedMessage> {
    // 多数调用方需要 attachments，我们通过 findMany + attach 组合或直接带 include
    // 这里采用简便方法：再次 listRecent 获取对应消息的 attach 形式
    const all = await this.database.tutorMessage.findMany({
      where: { conversationId: message.conversationId },
      orderBy: { sequence: "asc" },
      take: 1,
    });
    const enriched = all[0];
    if (enriched && enriched.id === message.id) {
      return { ...message, attachments: (enriched as AcceptedMessage).attachments ?? [] };
    }
    return { ...message, attachments: [] };
  }

  private async assertChildInFamily(parentProfileId: string, childId: string): Promise<void> {
    // 使用 ConversationService 的 parentProfile include 方式
    // 这里通过 Prisma 原始 findUnique，但 ConversationDatabase 在本模块未暴露。
    // 因此借用 Prisma 客户端，调用方也可以传 parentProfileId 校验
    const p = await (prisma as unknown as {
      parentProfile: { findUnique(args: { where: { id: string }; include: { children: { where: { id: string }; select: { id: true } } } }): Promise<{ id: string; children: Array<{ id: string }> } | null> };
    }).parentProfile.findUnique({
      where: { id: parentProfileId },
      include: { children: { where: { id: childId }, select: { id: true } } },
    });
    if (!p || !p.children || p.children.length === 0) {
      throw new AppError("FORBIDDEN", 403, "Child is not in the parent family");
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}

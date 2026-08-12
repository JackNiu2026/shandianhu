/**
 * V2.2 辅导摘要服务
 *
 * 1) 每次会话生成完成（ASSISTANT message 置 COMPLETE）后，异步触发摘要生成 job。
 * 2) Job 执行：抓取该会话最近 N 轮对话 → 用已发布的 prompt 的结构化摘要指令
 *    向模型要 JSON -> 落库 tutorConversationSummary（自增 version，latest 标记）。
 * 3) 把摘要中的弱知识点 + 技能表现回流到学习画像的 Observation（正向证据），
 *    形成"辅导 -> 画像 -> 报告 -> 辅导上下文"双向闭环。
 */
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { randomUUID } from "node:crypto";
import type { Prisma, ChildProfile } from "@prisma/client";

// ─── 类型 ──────────────────────────────────────────────────

export type KnowledgePointPerformance = "STRONG" | "MIXED" | "WEAK";

export interface TutoringSummaryInput {
  conversationId: string;
  /** 新生成或更新的摘要（通常是模型输出的 JSON） */
  knowledgePoints: Array<{ name: string; performance: KnowledgePointPerformance }>;
  difficulties: string[];
  demonstratedSkills: string[];
  nextSuggestions: string[];
}

export interface TutoringSummaryRecord {
  id: string;
  conversationId: string;
  version: number;
  knowledgePoints: Array<{ name: string; performance: KnowledgePointPerformance }>;
  difficulties: string[];
  demonstratedSkills: string[];
  nextSuggestions: string[];
  latest: boolean;
  createdAt: Date;
}

const LATEST_CONVERSATION_TURNS = 20;
const SUMMARY_TO_PROFILE_CONFIDENCE = 0.72; // 辅导证据的默认置信度

// ─── 服务实现 ──────────────────────────────────────────────

export class TutoringSummaryService {
  /**
   * 针对会话执行摘要生成的入队（幂等）
   * dedupeKey = `tutor-summ-${conversationId}-${lastCompletedAssistantMessageId}`
   */
  async enqueueIfNeeded(params: {
    conversationId: string;
    lastAssistantMessageId: string;
    requestedByUserId: string | null;
  }): Promise<{ enqueued: boolean; jobId?: string }> {
    const { conversationId, lastAssistantMessageId, requestedByUserId } = params;
    const conv = await prisma.tutorConversation.findUnique({
      where: { id: conversationId },
      select: { childId: true },
    });
    if (!conv) throw new AppError("NOT_FOUND", 404, "Conversation not found");

    const dedupeKey = `tutor-summ-${conversationId}-${lastAssistantMessageId}`;
    const prior = await prisma.asyncJob.findFirst({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    if (prior) return { enqueued: false, jobId: prior.id };

    const { JobQueueService } = await import("../jobs/job-service");
    const id = `job-${randomUUID()}`;
    const job = await prisma.asyncJob.create({
      data: {
        id,
        type: "TUTORING_SUMMARY",
        dedupeKey,
        payload: { conversationId, assistantMessageId: lastAssistantMessageId },
        requestedByUserId,
        childId: conv.childId,
      },
    });
    // 触发队列：
    try {
      const queue: any = new (JobQueueService as any)();
      await queue?.enqueue?.(job.id);
    } catch { /* ignore — worker polling 也能兜底 */ }
    return { enqueued: true, jobId: id };
  }

  /**
   * 生成 + 持久化 + 画像回流的"同步执行入口"（worker 会调用这里）
   *
   * 为避免强依赖模型调用（抽象层还没统一 summary prompt），
   * 这里接受一个 extractor 函数（生产环境会接模型 JSON 抽取）。
   * 默认 extractor 用简单启发式生成空摘要，供测试和骨架运行。
   */
  async runForConversation(
    conversationId: string,
    extractor: (turns: Array<{ user: string; assistant: string }>) => Promise<TutoringSummaryInput> = defaultExtractor,
  ): Promise<TutoringSummaryRecord> {
    const conv = await prisma.tutorConversation.findUnique({
      where: { id: conversationId },
      select: { childId: true, id: true },
    });
    if (!conv) throw new AppError("NOT_FOUND", 404, "Conversation not found");

    const turns = await this.fetchConversationTurns(conversationId, LATEST_CONVERSATION_TURNS);
    const partialSummary = await extractor(turns);

    return prisma.$transaction(async (tx) => {
      // 取消同会话所有旧 latest 标记
      await tx.tutorConversationSummary.updateMany({
        where: { conversationId, latest: true },
        data: { latest: false },
      });
      // 计算 version
      const maxVersion = await tx.tutorConversationSummary.aggregate({
        where: { conversationId },
        _max: { version: true },
      });
      const version = (maxVersion._max.version ?? 0) + 1;
      const created = await tx.tutorConversationSummary.create({
        data: {
          id: `tsum-${randomUUID()}`,
          conversationId,
          version,
          knowledgePoints:
            partialSummary.knowledgePoints as unknown as Prisma.JsonArray,
          difficulties: partialSummary.difficulties as unknown as Prisma.JsonArray,
          demonstratedSkills:
            partialSummary.demonstratedSkills as unknown as Prisma.JsonArray,
          nextSuggestions:
            partialSummary.nextSuggestions as unknown as Prisma.JsonArray,
          latest: true,
        },
      });

      // 画像回流：把知识点表现 + 展示技能写入 profile evidence
      const profile = await tx.childProfile.findUnique({
        where: { childId: conv.childId },
        select: { id: true, body: true },
      });
      if (profile) {
        const evidenceIds: string[] = [];
        // 1. 每个 knowledge point -> 一条 observation（WEAK 降低）
        for (const kp of partialSummary.knowledgePoints) {
          const obs = await tx.profileEvidenceObservation.create({
            data: {
              id: `obs-${randomUUID()}`,
              source: "TUTOR_SUMMARY",
              profileId: profile.id,
              summary:
                kp.performance === "WEAK"
                  ? `辅导会话中遇到 ${kp.name} 相关问题时表现较弱`
                  : kp.performance === "STRONG"
                    ? `在 ${kp.name} 知识点展示较强掌握`
                    : `${kp.name} 掌握混合，需要练习`,
              evidenceDirection:
                kp.performance === "WEAK" ? "NEGATIVE" : kp.performance === "STRONG" ? "POSITIVE" : "MIXED",
              confidence: SUMMARY_TO_PROFILE_CONFIDENCE,
              occurredAt: new Date(),
              tags: {
                create: [
                  { id: `tag-${randomUUID()}`, key: "DOMAIN", value: kp.name },
                  { id: `tag-${randomUUID()}`, key: "ORIGIN", value: "TUTOR_SUMMARY" },
                ],
              },
            },
          });
          evidenceIds.push(obs.id);
        }
        // 2. demonstratedSkills -> 每条 POSITIVE observation
        for (const skill of partialSummary.demonstratedSkills.slice(0, 8)) {
          const obs = await tx.profileEvidenceObservation.create({
            data: {
              id: `obs-${randomUUID()}`,
              source: "TUTOR_SUMMARY",
              profileId: profile.id,
              summary: `辅导会话中表现出的能力：${skill}`,
              evidenceDirection: "POSITIVE",
              confidence: SUMMARY_TO_PROFILE_CONFIDENCE,
              occurredAt: new Date(),
              tags: {
                create: [
                  { id: `tag-${randomUUID()}`, key: "SKILL", value: skill.slice(0, 64) },
                  { id: `tag-${randomUUID()}`, key: "ORIGIN", value: "TUTOR_SUMMARY" },
                ],
              },
            },
          });
          evidenceIds.push(obs.id);
        }
        // 3. profile body 合并 evidenceIds（不重建整体画像，只附加）
        const body = (profile.body ?? {}) as Record<string, unknown>;
        const existing = Array.isArray((body as any).evidenceIds) ? (body as any).evidenceIds as string[] : [];
        const merged = Array.from(new Set([...existing, ...evidenceIds]));
        const latestObservedAt = (() => {
          const candidate = new Date();
          const prev = (body as any).latestObservedAt
            ? new Date((body as any).latestObservedAt)
            : null;
          return prev && prev > candidate ? prev.toISOString() : candidate.toISOString();
        })();
        await tx.childProfile.update({
          where: { id: profile.id },
          data: {
            body: {
              ...body,
              evidenceIds: merged,
              evidenceCount: merged.length,
              latestObservedAt,
            } as Prisma.InputJsonObject,
            updatedAt: new Date(),
          },
        });
        // 4. profile 需要增量重建（比如重新计算指标）：排队 PROFILE_GENERATION
        try {
          const { JobQueueService } = await import("../jobs/job-service");
          const existingProfileJob = await tx.asyncJob.findFirst({
            where: {
              childId: conv.childId,
              type: "PROFILE_GENERATION",
              status: { in: ["PENDING", "QUEUED", "RUNNING", "RETRY_WAIT"] },
            },
            select: { id: true },
          });
          if (!existingProfileJob) {
            const dedupeKey = `profile-rebuild-${conv.childId}-${Date.now()}`;
            const j = await tx.asyncJob.create({
              data: {
                id: `job-${randomUUID()}`,
                type: "PROFILE_GENERATION",
                dedupeKey,
                payload: { childId: conv.childId },
                childId: conv.childId,
              },
            });
            try {
              const queue: any = new (JobQueueService as any)();
              await queue?.enqueue?.(j.id);
            } catch { /* ignore */ }
          }
        } catch { /* 失败不影响摘要落库 */ }
      }

      return {
        id: created.id,
        conversationId: created.conversationId,
        version: created.version,
        knowledgePoints:
          created.knowledgePoints as unknown as TutoringSummaryRecord["knowledgePoints"],
        difficulties: created.difficulties as string[],
        demonstratedSkills: created.demonstratedSkills as string[],
        nextSuggestions: created.nextSuggestions as string[],
        latest: created.latest,
        createdAt: created.createdAt,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable ?? "Serializable" });
  }

  private async fetchConversationTurns(conversationId: string, nTurns: number) {
    const msgs = await prisma.tutorMessage.findMany({
      where: { conversationId },
      orderBy: { sequence: "desc" },
      take: nTurns * 2,
      select: { role: true, content: true, sequence: true },
    });
    const asc = msgs.slice().reverse();
    const turns: Array<{ user: string; assistant: string }> = [];
    for (let i = 0; i < asc.length - 1; i++) {
      if (asc[i].role === "USER" && asc[i + 1].role === "ASSISTANT") {
        turns.push({ user: asc[i].content, assistant: asc[i + 1].content });
        i += 1;
      }
    }
    return turns.slice(-nTurns);
  }
}

// ─── 默认摘要提取器（骨架/测试用） ─────────────────────────
// 真实产品会接入模型：输入会话轮次 + prompt，要求结构化 JSON 输出。

async function defaultExtractor(
  _turns: Array<{ user: string; assistant: string }>,
): Promise<TutoringSummaryInput> {
  return {
    conversationId: "", // 未使用
    knowledgePoints: [],
    difficulties: [],
    demonstratedSkills: [],
    nextSuggestions: [],
  };
}

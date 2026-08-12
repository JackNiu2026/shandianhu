export type TutorSummaryProcessorDeps = {
  summaries?: { runForConversation(conversationId: string): Promise<{ id: string; version: number; knowledgePoints?: unknown[]; demonstratedSkills?: unknown[] }> };
};

export type TutorSummaryRunInput = {
  conversationId: string;
};

export type TutorSummaryRunOutput = {
  summaryId: string;
  version: number;
  observationCount: number;
};

/**
 * V2.2 辅导摘要回流处理器（Worker 进程执行）
 *
 * 触发：assistant message finalize 时 summary-service enqueueIfNeeded。
 * 责任：
 * - 读会话 -> 调用 summaryService.runForConversation
 * - runForConversation 会：落库 tutorConversationSummary + 回流到
 *   profile 证据 observations + 触发 PROFILE_GENERATION job
 */
export class TutorSummaryProcessor {
  constructor(
    private readonly deps: TutorSummaryProcessorDeps = {},
  ) {}

  async run(input: TutorSummaryRunInput): Promise<TutorSummaryRunOutput> {
    if (!this.deps.summaries) throw new Error("Tutoring summary processor is not configured");
    const result = await this.deps.summaries.runForConversation(input.conversationId);
    return {
      summaryId: result.id,
      version: result.version,
      observationCount:
        (result.knowledgePoints?.length ?? 0) + (result.demonstratedSkills?.length ?? 0),
    };
  }
}

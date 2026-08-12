/**
 * V2.2 辅导流式生成服务
 *
 * 协调：QuotaService（预占积分）→ MessageService（创建助手消息）
 *     → 模型流式 → 增量写入 content → Settle（结算）
 *
 * 停止生成（cancellation）：
 * - 客户端 POST generations/[id]/cancel 设置取消标志
 * - stream-service 在每个 delta 事件后检查该标志，触发时发送 done(cancelled)
 *   并将 generationStatus 改为 CANCELLED，同时释放积分（不扣消耗）
 *
 * 该服务只负责协调与调度，实际 NDJSON 输出和 HTTP response 由 route handler 组装。
 */
import { AppError } from "../errors/app-error";
import type { ConversationService } from "./conversation-service";
import type { MessageService } from "./message-service";
import type { QuotaService } from "../quota/quota-service";
import { estimateReservationPoints, calculatePoints } from "../quota/points";
import type { ModelUsagePurpose } from "../models/usage-service";

// ─── 类型 ──────────────────────────────────────────────────

export type GenerationHandle = {
  generationId: string;
  assistantMessageId: string;
  reservationId: string;
  operationKey: string;
};

export type GenerationRuntime = {
  cancelled: boolean;
  // 生成完成后会赋值（usage）
  result?: {
    finishReason: "stop" | "length" | "cancelled";
    inputTokens?: number;
    outputTokens?: number;
    images?: number;
  };
};

/** 简化版 quota/messages 接口，避免循环依赖具体实现 */
interface SvcDeps {
  quota: Pick<QuotaService, "reserve" | "settle" | "release">;
  messages: Pick<MessageService, "createAssistant" | "updateAssistantProgress" | "finalizeAssistant" | "listRecent">;
  conversations: Pick<ConversationService, "get">;
}

/** 进程内的生成取消注册表（未来可替换为 Redis pub/sub） */
export class GenerationCancellationRegistry {
  private state = new Map<string, GenerationRuntime>();

  /** 创建 runtime 结构并返回 id。幂等：传入存在的 generationId 返回原 runtime。 */
  register(generationId: string): GenerationRuntime {
    const existing = this.state.get(generationId);
    if (existing) return existing;
    const runtime: GenerationRuntime = { cancelled: false };
    this.state.set(generationId, runtime);
    return runtime;
  }

  /** 标记取消；已结束的也允许标记（只影响状态，防止重复设置 race） */
  cancel(generationId: string): boolean {
    const rt = this.state.get(generationId);
    if (!rt) return false;
    rt.cancelled = true;
    return true;
  }

  get(generationId: string): GenerationRuntime | undefined {
    return this.state.get(generationId);
  }

  /** 完成后清理；默认只清理已完成超过 1h 的（防止并发问题） */
  cleanup(generationId: string): void {
    this.state.delete(generationId);
  }
}

// 全局 registry（单例即可）
export const defaultCancellationRegistry = new GenerationCancellationRegistry();

// ─── 服务实现 ──────────────────────────────────────────────

export type BeginStreamingInput = {
  conversationId: string;
  /** viewer 的家长 id，传则做权限检查 */
  parentProfileId?: string;
  /** 用户消息对应的 clientMessageId / 助手 clientMessageId 规则 assn-{userMsgId}-{seq} */
  userClientMessageId?: string;
  /** 调用方估算：当前输入 tokens + 附件图片数 */
  inputTokens: number;
  images?: number;
  /** agent max output tokens 上限，用于预占估算 */
  maxOutputTokens: number;
  /** 助手消息的用途：TUTORING / PROMPT_TEST 等 */
  purpose: ModelUsagePurpose;
  /** 调用方可传固定 id，用于跨系统追踪（否则自动生成 gen-{uuid}） */
  generationId?: string;
  /** 调用方可传 registry 覆盖，利于测试 */
  registry?: GenerationCancellationRegistry;
};

export type BeginStreamingResult = {
  generationId: string;
  assistantMessageId: string;
  reservationId: string;
  runtime: GenerationRuntime;
};

export class StreamService {
  constructor(
    private readonly deps: SvcDeps,
    private readonly uuidFn: () => string = () =>
      // 简单 cuid 风格；真实环境使用 randomUUID 或 prisma cuid()
      "gen-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  ) {}

  /**
   * 启动流式生成：
   *   1. 校验会话存在且该家长可访问
   *   2. 估算积分上限，reserve（幂等 operationKey）
   *   3. 创建 ASSISTANT PENDING 消息（clientMessageId = {conversationId}:assist:{seq}）
   *   4. 返回 generationId + runtime（可被 cancel 接口写入取消）
   */
  async begin(input: BeginStreamingInput): Promise<BeginStreamingResult> {
    // 1. 校验会话
    const conv = await this.deps.conversations.get(input.conversationId, input.parentProfileId);
    if (!conv) throw new AppError("NOT_FOUND", 404, "Conversation not found");

    // 2. 预占估算
    const points = estimateReservationPoints({
      inputTokens: input.inputTokens,
      maxOutputTokens: input.maxOutputTokens,
      images: input.images ?? 0,
    });
    const generationId = input.generationId ?? this.uuidFn();
    const operationKey = `tutor-reserve-${generationId}`;

    const reservation = await this.deps.quota.reserve({
      parentProfileId: input.parentProfileId!, // reserve 必填；如果没有传，上游必须保证
      childId: conv.childId,
      operationKey,
      points,
    }).catch((error) => {
      // parentProfileId 为空时抛错更清晰
      if (!input.parentProfileId) {
        throw new AppError("VALIDATION_ERROR", 400, "parentProfileId is required for quota reservation");
      }
      throw error;
    });

    // 3. 助手消息
    const messages = await this.deps.messages.listRecent(input.conversationId, 1);
    const nextSeq = (messages[messages.length - 1]?.sequence ?? -1) + 1;
    const assistantClientMsgId = `assist-${generationId}`;
    const assistantMsg = await this.deps.messages.createAssistant({
      conversationId: input.conversationId,
      clientMessageId: assistantClientMsgId,
      sequence: nextSeq,
    });

    // 4. 注册取消 runtime
    const runtime = (input.registry ?? defaultCancellationRegistry).register(generationId);
    return {
      generationId,
      assistantMessageId: assistantMsg.id,
      reservationId: reservation.reservationId,
      runtime,
    };
  }

  /** 最终化：根据完成情况结算或释放积分，更新助手消息状态 */
  async finish(params: {
    generationId: string;
    assistantMessageId: string;
    reservationId: string;
    conversationId: string;
    parentProfileId: string;
    childId: string;
    /** 最终完整文本（流式会累积得出，这里一次性写回） */
    finalText: string;
    /** stop/length/cancelled */
    finishReason: "stop" | "length" | "cancelled";
    /** 模型实际用量（用于 settlement） */
    usage?: { inputTokens?: number; outputTokens?: number; images?: number };
    modelCallId?: string;
    registry?: GenerationCancellationRegistry;
  }): Promise<void> {
    const { usage, finishReason } = params;
    const status: "COMPLETE" | "CANCELLED" | "FAILED" =
      finishReason === "cancelled"
        ? "CANCELLED"
        : finishReason === "stop" || finishReason === "length"
          ? "COMPLETE"
          : "FAILED";

    await this.deps.messages.finalizeAssistant(
      params.assistantMessageId,
      status,
      { finalText: params.finalText, modelCallId: params.modelCallId },
    );

    if (finishReason === "cancelled") {
      // 用户取消：释放预占，不结算
      await this.deps.quota.release({
        parentProfileId: params.parentProfileId,
        reservationId: params.reservationId,
        operationKey: `tutor-release-${params.generationId}`,
        childId: params.childId,
        reason: "User cancelled generation",
      });
    } else {
      // 正常结束：结算
      const it = usage?.inputTokens ?? 0;
      const ot = usage?.outputTokens ?? Math.max(0, params.finalText.length * 4); // 粗估：无 usage 信息时按字符估算
      const im = usage?.images ?? 0;
      const usedPoints = calculatePoints({ inputTokens: it, outputTokens: ot, images: im });
      await this.deps.quota.settle({
        parentProfileId: params.parentProfileId,
        reservationId: params.reservationId,
        operationKey: `tutor-settle-${params.generationId}`,
        actualUsedPoints: usedPoints,
        modelCallId: params.modelCallId,
        childId: params.childId,
      });
    }

    (params.registry ?? defaultCancellationRegistry).cleanup(params.generationId);
  }

  /** 失败：释放积分并将助手消息置为 FAILED */
  async fail(params: {
    generationId: string;
    assistantMessageId: string;
    reservationId: string;
    conversationId: string;
    parentProfileId: string;
    childId: string;
    reason?: string;
    registry?: GenerationCancellationRegistry;
  }): Promise<void> {
    try {
      await this.deps.messages.finalizeAssistant(params.assistantMessageId, "FAILED");
    } catch { /* ignore */ }
    try {
      await this.deps.quota.release({
        parentProfileId: params.parentProfileId,
        reservationId: params.reservationId,
        operationKey: `tutor-release-fail-${params.generationId}`,
        childId: params.childId,
        reason: params.reason ?? "Generation failed",
      });
    } catch { /* ignore */ }
    (params.registry ?? defaultCancellationRegistry).cleanup(params.generationId);
  }
}

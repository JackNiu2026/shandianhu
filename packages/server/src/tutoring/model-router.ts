/**
 * V2.2 智能体模型路由
 *
 * 主备模型切换决策器：
 * - 主模型在第一个 delta 之前失败（连接错误、超时、429、5xx 等）→ 切换备用
 * - 主模型在第一个 delta 之后失败 → 抛 retryWithoutFallback 错误，避免拼接两个模型答案
 * - 备用模型也失败 → 抛可重试错误，不创建伪造文本
 *
 * 注意：本模块是决策模块，完整消费模型流以决定 route 或抛错。
 * 实际流式传输由 stream-service 处理，它会在流式过程中应用相同的切换规则。
 * 错误对象上的 `events` 字段保留已收到的事件，供 stream-service 恢复部分输出。
 */
import type { ApiErrorCode } from "@lightning-tiger/shared";
import type { ModelContent, ModelMessage } from "../models/openai-gateway";
import type { ModelUsagePurpose } from "../models/usage-service";

// ─── 类型定义 ──────────────────────────────────────────────

export type ModelRouteRequest = {
  messages: ModelMessage[];
  purpose: ModelUsagePurpose;
  userId?: string;
  childId?: string;
  imageCount?: number;
  callId?: string;
  /** 当消息含图片附件时为 true，路由器会校验主模型是否支持视觉 */
  requiresVision?: boolean;
};

export type ModelStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; finishReason: "stop" | "length" | "cancelled" }
  | { type: "error"; code: ApiErrorCode; retryable: boolean };

export type OpenedStream = {
  callId: string;
  stream: AsyncIterable<ModelStreamEvent>;
  cancel(): Promise<void>;
};

/**
 * 模型提供者接口。
 *
 * openStream 应：
 * - 在连接/超时/429/5xx 等"第一个 delta 之前"的失败时 throw，并带上 beforeFirstDelta=true
 * - 在已输出 delta 后的失败时，将 error 作为 stream 的最后一个事件发出（不 throw）
 */
export interface ModelProvider {
  readonly name: "primary" | "fallback";
  openStream(request: ModelRouteRequest): Promise<OpenedStream>;
}

/**
 * openStream 抛出的错误形态。
 * beforeFirstDelta=true 表示尚未输出任何 delta，可切换备用。
 */
export type ModelProviderError = {
  code: ApiErrorCode;
  retryable: boolean;
  beforeFirstDelta: boolean;
  callId?: string;
};

export type ModelStreamHandle = {
  route: "primary" | "fallback";
  callId: string;
  events: ModelStreamEvent[];
};

/**
 * 路由错误。
 *
 * - retryWithoutFallback=true：主模型已输出 delta 后失败，禁止切换备用
 * - retryWithoutFallback=false：主模型在第一个 delta 之前失败且无可用备用
 * - events：已收到的事件（可能包含部分 delta），供上层恢复部分输出
 */
export class ModelRouteError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly retryable: boolean,
    public readonly retryWithoutFallback: boolean,
    public readonly events: ModelStreamEvent[] = [],
  ) {
    super(message);
    this.name = "ModelRouteError";
  }
}

// ─── 路由器实现 ────────────────────────────────────────────

type ConsumeOutcome =
  | { outcome: "completed"; callId: string; events: ModelStreamEvent[] }
  | {
      outcome: "failed-before-delta";
      callId: string;
      events: ModelStreamEvent[];
      code: ApiErrorCode;
      retryable: boolean;
    }
  | {
      outcome: "failed-after-delta";
      callId: string;
      events: ModelStreamEvent[];
      code: ApiErrorCode;
      retryable: boolean;
    };

export class ModelRouter {
  constructor(
    private readonly primary: ModelProvider,
    private readonly fallback: ModelProvider | null,
  ) {}

  async open(request: ModelRouteRequest): Promise<ModelStreamHandle> {
    const primaryResult = await this.consume(this.primary, request);

    if (primaryResult.outcome === "completed") {
      return {
        route: "primary",
        callId: primaryResult.callId,
        events: primaryResult.events,
      };
    }

    if (primaryResult.outcome === "failed-after-delta") {
      // 主模型已输出 delta 后失败，禁止切换备用，避免拼接两个模型答案
      throw new ModelRouteError(
        "Primary model failed after emitting delta; cannot switch to fallback",
        primaryResult.code,
        primaryResult.retryable,
        true, // retryWithoutFallback
        primaryResult.events,
      );
    }

    // 主模型在第一个 delta 之前失败，尝试切换备用
    return this.openFallback(request, primaryResult);
  }

  private async openFallback(
    request: ModelRouteRequest,
    primaryResult: Extract<ConsumeOutcome, { outcome: "failed-before-delta" }>,
  ): Promise<ModelStreamHandle> {
    if (!this.fallback) {
      throw new ModelRouteError(
        "Primary model failed before first delta and no fallback configured",
        primaryResult.code,
        primaryResult.retryable,
        false, // retryWithoutFallback
        primaryResult.events,
      );
    }

    const fallbackResult = await this.consume(this.fallback, request);

    if (fallbackResult.outcome === "completed") {
      return {
        route: "fallback",
        callId: fallbackResult.callId,
        events: fallbackResult.events,
      };
    }

    // 备用模型是最后的选择，无论在 delta 之前还是之后失败，都视为两个模型都失败
    throw new ModelRouteError(
      "Both primary and fallback models failed",
      fallbackResult.code,
      false, // 两个模型都失败，不鼓励盲目重试
      false, // retryWithoutFallback
      fallbackResult.events,
    );
  }

  private async consume(provider: ModelProvider, request: ModelRouteRequest): Promise<ConsumeOutcome> {
    let opened: OpenedStream;
    try {
      opened = await provider.openStream(request);
    } catch (error) {
      const providerError = normalizeProviderError(error);
      return {
        outcome: "failed-before-delta",
        callId: providerError.callId ?? "",
        events: [],
        code: providerError.code,
        retryable: providerError.retryable,
      };
    }

    const events: ModelStreamEvent[] = [];
    let hasDelta = false;
    for await (const event of opened.stream) {
      events.push(event);
      if (event.type === "delta") {
        hasDelta = true;
      } else if (event.type === "done") {
        if (hasDelta) {
          return { outcome: "completed", callId: opened.callId, events };
        }
        return {
          outcome: "failed-before-delta",
          callId: opened.callId,
          events,
          code: "MODEL_UNAVAILABLE",
          retryable: true,
        };
      } else if (event.type === "error") {
        return {
          outcome: hasDelta ? "failed-after-delta" : "failed-before-delta",
          callId: opened.callId,
          events,
          code: event.code,
          retryable: event.retryable,
        };
      }
    }
    // A stream which yields no user-visible text is not a successful answer.
    if (!hasDelta) {
      return {
        outcome: "failed-before-delta",
        callId: opened.callId,
        events,
        code: "MODEL_UNAVAILABLE",
        retryable: true,
      };
    }
    return { outcome: "completed", callId: opened.callId, events };
  }
}

function normalizeProviderError(error: unknown): ModelProviderError {
  if (error && typeof error === "object" && "code" in error && "retryable" in error) {
    const e = error as Partial<ModelProviderError>;
    return {
      code: (e.code as ApiErrorCode) ?? "MODEL_UNAVAILABLE",
      retryable: Boolean(e.retryable),
      beforeFirstDelta: e.beforeFirstDelta ?? true,
      callId: e.callId,
    };
  }
  return {
    code: "MODEL_UNAVAILABLE",
    retryable: true,
    beforeFirstDelta: true,
  };
}

// ─── 辅助：从 ModelMessage[] 中检测是否需要视觉能力 ─────────

export function requestRequiresVision(messages: ModelMessage[]): boolean {
  return messages.some((m) => typeof m.content !== "string" && Array.isArray(m.content) &&
    m.content.some((part) => typeof part === "object" && part !== null && "type" in part && part.type === "image_url"));
}

/** 从消息中提取图片数量，用于成本计算 */
export function countImages(messages: ModelMessage[]): number {
  let count = 0;
  for (const m of messages) {
    if (typeof m.content !== "string" && Array.isArray(m.content)) {
      for (const part of m.content) {
        if (typeof part === "object" && part !== null && "type" in part && part.type === "image_url") {
          count += 1;
        }
      }
    }
  }
  return count;
}

// 重新导出 ModelContent/ModelMessage 以方便调用方
export type { ModelContent, ModelMessage };

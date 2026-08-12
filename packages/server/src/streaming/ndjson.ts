/**
 * V2.2 UTF-8 NDJSON 流式编码
 *
 * 帧格式：
 *   每条事件一行 JSON（UTF-8），由 \n 分隔。最后一行也以 \n 结尾，
 *   方便客户端增量解码时把"尾部不完整行"缓存到下次再解析。
 *
 * 关键语义：
 * - sequence：单调递增，客户端可检测丢帧
 * - start 事件携带 assistantMessageId + model（primary/fallback）
 * - delta 事件是增量文本（不是完整累积），客户端负责拼接
 * - usage 事件在 done 之前或之后发出，但最终消费结果以此为准
 * - done 事件标志成功结束（stop/length）或用户取消（cancelled）
 * - error 事件是最后一条；除非 code 对应的 retryable=true，否则不应重试
 *
 * 客户端解码流程（增量）：
 *   1. 把新来的 Uint8Array 追加到内部 buffer
 *   2. 以 \n 切割：所有完整行逐个 JSON.parse 处理
 *   3. 最后不完整行（可能是被字节拆开的中文/大 JSON）留在 buffer
 */
import type { TutorStreamEvent } from "@lightning-tiger/shared/api/tutoring";

type TutorStreamStartData = Extract<TutorStreamEvent, { type: "start" }>['data'];
type TutorStreamErrorCode = Extract<TutorStreamEvent, { type: "error" }>['data']['code'];

/**
 * 将单条事件编码为一行 NDJSON（UTF-8）+ "\n"。
 */
export function encodeEvent(event: TutorStreamEvent): Uint8Array {
  const line = JSON.stringify(event) + "\n";
  return new TextEncoder().encode(line);
}

/**
 * 批量编码多条事件：保证每行都以 \n 结尾，各行按传入顺序输出。
 */
export function encodeEvents(events: TutorStreamEvent[]): Uint8Array {
  if (events.length === 0) return new Uint8Array(0);
  const parts = events.map((event) => JSON.stringify(event));
  const text = parts.join("\n") + "\n";
  return new TextEncoder().encode(text);
}

/**
 * 顺序 + 校验编码器：自动维护 sequence，保证单调递增。
 */
export class NdjsonFrameEncoder {
  private nextSequence = 1;

  nextSequenceNumber(): number {
    return this.nextSequence;
  }

  /** 生成 start 帧（sequence 自增） */
  start(payload: TutorStreamStartData): Uint8Array {
    return this.enclose({ type: "start", sequence: this.takeSeq(), data: payload });
  }

  /** 生成 delta 帧 */
  delta(text: string): Uint8Array {
    return this.enclose({ type: "delta", sequence: this.takeSeq(), data: { text } });
  }

  /** 生成 usage 帧 */
  usage(chargedPoints: number): Uint8Array {
    return this.enclose({ type: "usage", sequence: this.takeSeq(), data: { chargedPoints } });
  }

  /** 生成 done 帧 */
  done(finishReason: "stop" | "length" | "cancelled"): Uint8Array {
    return this.enclose({ type: "done", sequence: this.takeSeq(), data: { finishReason } });
  }

  /** 生成 error 帧 */
  error(code: TutorStreamErrorCode, retryable: boolean): Uint8Array {
    return this.enclose({ type: "error", sequence: this.takeSeq(), data: { code, retryable } } as TutorStreamEvent);
  }

  /** 直接编码一个完整事件（也会自增 sequence——如事件已自填 sequence，用 rawFrame） */
  private enclose(event: TutorStreamEvent): Uint8Array {
    return encodeEvent(event);
  }

  /** 不校验顺序的原始帧编码（服务端转发时谨慎使用） */
  rawFrame(event: TutorStreamEvent): Uint8Array {
    return encodeEvent(event);
  }

  private takeSeq(): number {
    const seq = this.nextSequence;
    this.nextSequence += 1;
    return seq;
  }
}

// ─── 客户端增量解码器（纯算法，方便小程序复用）───────────

export type DecodeResult = {
  events: TutorStreamEvent[];
  /** 尾部未完成的字节，下次增量解码作为 prefix 传入 */
  residue: Uint8Array;
};

/**
 * 增量解码：把新的字节 chunk 拼到旧 residue 末尾，
 * 按 '\n' = 0x0A 切分，完整行 JSON.parse 后返回，残差留给下一次。
 * 中文被拆成两段字节时安全：未结尾的行不会被 decode 成非法 UTF-8 字符串。
 */
export function ndjsonIncrementalDecode(chunk: Uint8Array, previousResidue: Uint8Array): DecodeResult {
  const buffer = concat(previousResidue, chunk);
  const events: TutorStreamEvent[] = [];
  let cursor = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0A) {
      const start = cursor;
      const end = i;
      cursor = i + 1;
      // 空行跳过
      if (end === start) continue;
      const slice = buffer.subarray(start, end);
      const text = utf8DecodeStrict(slice);
      if (text === null) continue; // 坏行安全跳过
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { continue; }
      if (isStreamEvent(parsed)) events.push(parsed);
    }
  }
  const residue = cursor < buffer.length ? buffer.slice(cursor) : new Uint8Array(0);
  return { events, residue };
}

function utf8DecodeStrict(bytes: Uint8Array): string | null {
  try {
    // TextDecoder 默认行为：遇到非法字节序列会替换而不是抛错；这正是我们希望的容错。
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ─── 窄化：运行时校验 TutorStreamEvent 形状（避免坏消息导致客户端异常）

function isStreamEvent(value: unknown): value is TutorStreamEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  if (typeof v.sequence !== "number") return false;
  if (!v.data || typeof v.data !== "object") return false;
  switch (v.type) {
    case "start":
      return typeof (v.data as Record<string, unknown>).assistantMessageId === "string"
        && ["primary", "fallback"].includes(String((v.data as Record<string, unknown>).model));
    case "delta":
      return typeof (v.data as Record<string, unknown>).text === "string";
    case "usage":
      return typeof (v.data as Record<string, unknown>).chargedPoints === "number";
    case "done":
      return ["stop", "length", "cancelled"].includes(String((v.data as Record<string, unknown>).finishReason));
    case "error":
      return typeof (v.data as Record<string, unknown>).code === "string"
        && typeof (v.data as Record<string, unknown>).retryable === "boolean";
    default:
      return false;
  }
}

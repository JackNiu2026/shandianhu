/**
 * 小程序端 NDJSON 流式增量解码器（纯 TS，不依赖 TextDecoder/Buffer）
 *
 * 原因：
 * - Taro 小程序环境的 request.onChunkReceived 返回 ArrayBuffer
 * - 微信基础库只保证 UTF-8 字节流；中文可能被切成两半
 * - JSON.parse 只能喂完整行
 *
 * 算法与服务端一致：按 '\n'=0x0A 切分，残差保留到下次，完整行手动 UTF-8 → string → JSON.parse
 */
import type { TutorStreamEvent } from "@lightning-tiger/shared/api/tutoring";

export type DecodeResult = {
  events: TutorStreamEvent[];
  residue: Uint8Array;
};

/**
 * 增量解码主入口
 *
 * @param chunk 新收到的字节（来自 onChunkReceived，通常是 ArrayBuffer → Uint8Array）
 * @param previousResidue 上次未解析完的残差
 */
export function ndjsonChunkDecode(
  chunk: Uint8Array,
  previousResidue: Uint8Array,
): DecodeResult {
  const buffer = concat(previousResidue, chunk);
  const events: TutorStreamEvent[] = [];
  let cursor = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0A) {
      const start = cursor;
      const end = i;
      cursor = i + 1;
      if (end === start) continue;
      const slice = buffer.subarray(start, end);
      const text = utf8Decode(slice);
      if (!text) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      if (isStreamEvent(parsed)) events.push(parsed);
    }
  }
  const residue = cursor < buffer.length ? buffer.slice(cursor) : new Uint8Array(0);
  return { events, residue };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** 兼容小程序环境的 UTF-8 解码；处理被拆开的多字节序列不会抛错 */
function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i];
    if (b1 < 0x80) {
      out += String.fromCharCode(b1);
      i += 1;
      continue;
    }
    // Multi-byte
    let cp = 0;
    if ((b1 & 0xe0) === 0xc0) {
      if (i + 1 >= bytes.length) break; // incomplete: caller will keep in residue
      const b2 = bytes[i + 1];
      cp = ((b1 & 0x1f) << 6) | (b2 & 0x3f);
      i += 2;
    } else if ((b1 & 0xf0) === 0xe0) {
      if (i + 2 >= bytes.length) break;
      const b2 = bytes[i + 1], b3 = bytes[i + 2];
      cp = ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      i += 3;
    } else if ((b1 & 0xf8) === 0xf0) {
      if (i + 3 >= bytes.length) break;
      const b2 = bytes[i + 1], b3 = bytes[i + 2], b4 = bytes[i + 3];
      cp =
        ((b1 & 0x07) << 18) |
        ((b2 & 0x3f) << 12) |
        ((b3 & 0x3f) << 6) |
        (b4 & 0x3f);
      i += 4;
    } else {
      i += 1; // 非法前导字节，跳过，避免卡死
      continue;
    }
    if (cp < 0x10000) {
      out += String.fromCharCode(cp);
    } else {
      // UTF-16 surrogate pair
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10));
      out += String.fromCharCode(0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

// 窄化运行时校验（和 server 端对齐）
function isStreamEvent(value: unknown): value is TutorStreamEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  if (typeof v.sequence !== "number") return false;
  if (!v.data || typeof v.data !== "object") return false;
  const d = v.data as Record<string, unknown>;
  switch (v.type) {
    case "start":
      return typeof d.assistantMessageId === "string" && (d.model === "primary" || d.model === "fallback");
    case "delta":
      return typeof d.text === "string";
    case "usage":
      return typeof d.chargedPoints === "number";
    case "done":
      return d.finishReason === "stop" || d.finishReason === "length" || d.finishReason === "cancelled";
    case "error":
      return typeof d.code === "string" && typeof d.retryable === "boolean";
    default:
      return false;
  }
}

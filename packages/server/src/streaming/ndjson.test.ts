import { describe, expect, it } from "vitest";
import {
  NdjsonFrameEncoder,
  encodeEvent,
  encodeEvents,
  ndjsonIncrementalDecode,
} from "./ndjson";

// 共享事件序列和对应 shape
const SAMPLE_EVENTS: Parameters<typeof encodeEvents>[0] = [
  { type: "start", sequence: 1, data: { assistantMessageId: "am-1", model: "primary" as const } },
  { type: "delta", sequence: 2, data: { text: "你好" } },
  { type: "delta", sequence: 3, data: { text: "，同学" } },
  { type: "done", sequence: 4, data: { finishReason: "stop" as const } },
];

describe("encodeEvent(s)", () => {
  it("encodes one JSON object per UTF-8 line with newline terminator", () => {
    const bytes = encodeEvents([
      { type: "delta", sequence: 1, data: { text: "hi" } },
      { type: "done", sequence: 2, data: { finishReason: "stop" } },
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("\n");
    const lines = text.split("\n");
    // 最后一行换行 + 空尾
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual({ type: "delta", sequence: 1, data: { text: "hi" } });
    expect(JSON.parse(lines[1])).toEqual({ type: "done", sequence: 2, data: { finishReason: "stop" } });
    expect(lines[2]).toBe("");
  });

  it("handles empty input gracefully", () => {
    expect(encodeEvents([])).toEqual(new Uint8Array(0));
  });

  it("preserves non-ASCII (Chinese) characters when round-tripped", () => {
    const ev = { type: "delta", sequence: 1, data: { text: "同学你好，1+1=2。数学的奥秘无穷。" } };
    const bytes = encodeEvent(ev);
    const text = new TextDecoder().decode(bytes);
    expect(text.trim()).toBe(JSON.stringify(ev));
  });
});

describe("NdjsonFrameEncoder", () => {
  it("assigns monotonic sequence numbers", () => {
    const enc = new NdjsonFrameEncoder();
    const out = concatUint8([
      enc.start({ assistantMessageId: "am-1", model: "primary" }),
      enc.delta("hi"),
      enc.usage(5),
      enc.done("stop"),
    ]);
    const { events } = ndjsonIncrementalDecode(out, new Uint8Array(0));
    expect(events.map((e) => e.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("emits expected event shapes", () => {
    const enc = new NdjsonFrameEncoder();
    const out = concatUint8([
      enc.start({ assistantMessageId: "am-x", model: "fallback" }),
      enc.delta("first"),
      enc.delta(" second"),
      enc.usage(12),
      enc.done("length"),
    ]);
    const { events } = ndjsonIncrementalDecode(out, new Uint8Array(0));
    expect(events.map((e) => e.type)).toEqual(["start", "delta", "delta", "usage", "done"]);
    const start = events[0];
    expect(start.type === "start" && start.data.assistantMessageId).toBe("am-x");
    expect(start.type === "start" && start.data.model).toBe("fallback");
    const done = events[events.length - 1];
    expect(done.type === "done" && done.data.finishReason).toBe("length");
  });

  it("emits error frame with retryable flag", () => {
    const enc = new NdjsonFrameEncoder();
    const bytes = enc.error("MODEL_UNAVAILABLE", true);
    const { events } = ndjsonIncrementalDecode(bytes, new Uint8Array(0));
    expect(events).toHaveLength(1);
    const err = events[0];
    expect(err.type === "error" && err.data.code).toBe("MODEL_UNAVAILABLE");
    expect(err.type === "error" && err.data.retryable).toBe(true);
  });
});

describe("ndjsonIncrementalDecode", () => {
  it("decodes all complete lines on first chunk", () => {
    const bytes = encodeEvents(SAMPLE_EVENTS);
    const { events, residue } = ndjsonIncrementalDecode(bytes, new Uint8Array(0));
    expect(events).toHaveLength(4);
    expect(residue).toHaveLength(0);
    expect(events[0].type).toBe("start");
    expect(events[3].type).toBe("done");
  });

  it("preserves residue when a line is incomplete at the end", () => {
    const full = new TextEncoder().encode('{"type":"delta","sequence":1,"data":{"text":"a"}}\n{"type":"delta","sequence":2,"data":{"text":"b”  ');
    const { events, residue } = ndjsonIncrementalDecode(full, new Uint8Array(0));
    expect(events).toHaveLength(1);
    // 残差是不完整的那行（从第 2 行起）
    expect(residue.length).toBeGreaterThan(0);
    // 喂后续 chunk 补齐
    const next = new TextEncoder().encode('"}}\n');
    const joined = ndjsonIncrementalDecode(next, residue);
    expect(joined.events).toHaveLength(1);
    expect(joined.events[0].sequence).toBe(2);
  });

  it("handles Chinese characters split across two byte chunks safely", () => {
    const ev = { type: "delta", sequence: 1, data: { text: "同学你好" } };
    const full = encodeEvent(ev);
    // 切在"同"字（UTF-8 3 bytes 每个中文字符）的中间：
    // 先定位 JSON.data.text 之后的字符串。为简单起见，切中间任意位置：
    const mid = Math.floor(full.length / 2);
    const a = full.subarray(0, mid);
    const b = full.subarray(mid);
    const firstPass = ndjsonIncrementalDecode(a, new Uint8Array(0));
    expect(firstPass.events).toHaveLength(0); // 还没换行
    const secondPass = ndjsonIncrementalDecode(b, firstPass.residue);
    expect(secondPass.events).toHaveLength(1);
    const decoded = secondPass.events[0];
    expect(decoded.type === "delta" && decoded.data.text).toBe("同学你好");
  });

  it("skips invalid JSON lines while preserving valid neighbors", () => {
    const badLine = new TextEncoder().encode("this is not json\n");
    const good = encodeEvent({ type: "delta", sequence: 1, data: { text: "ok" } });
    const { events } = ndjsonIncrementalDecode(concatUint8([badLine, good]), new Uint8Array(0));
    expect(events).toHaveLength(1);
    expect(events[0].type === "delta" && events[0].data.text).toBe("ok");
  });

  it("rejects malformed event shape via isStreamEvent", () => {
    const malformed = new TextEncoder().encode('{"type":"unknown","sequence":1,"data":{}}\n{"type":"start","sequence":2,"data":{"assistantMessageId":"x","model":"bad"}}\n{"type":"start","sequence":3,"data":{"assistantMessageId":"ok","model":"primary"}}\n');
    const { events } = ndjsonIncrementalDecode(malformed, new Uint8Array(0));
    // 只有 sequence=3 的是合法 start 事件
    expect(events).toHaveLength(1);
    expect(events[0].sequence).toBe(3);
  });
});

function concatUint8(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

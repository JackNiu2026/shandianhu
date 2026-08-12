import { describe, expect, it } from "vitest";
import {
  ModelRouteError,
  ModelRouter,
  type ModelProvider,
  type ModelRouteRequest,
  type ModelStreamEvent,
} from "./model-router";

// ─── 测试用 Mock Provider ──────────────────────────────────

type MockScript =
  | { kind: "throw"; code: "MODEL_UNAVAILABLE"; retryable: boolean }
  | { kind: "events"; events: ModelStreamEvent[] };

class MockModelProvider implements ModelProvider {
  public openCallCount = 0;
  public lastRequest: ModelRouteRequest | null = null;
  private script: MockScript = { kind: "events", events: [{ type: "done", finishReason: "stop" }] };
  private cancelCount = 0;

  constructor(public readonly name: "primary" | "fallback") {}

  setScript(script: MockScript): this {
    this.script = script;
    return this;
  }

  failBeforeFirstDelta(code: "MODEL_UNAVAILABLE" = "MODEL_UNAVAILABLE", retryable = true): this {
    this.script = { kind: "throw", code, retryable };
    return this;
  }

  emit(...events: ModelStreamEvent[]): this {
    this.script = { kind: "events", events };
    return this;
  }

  succeed(text = "答案"): this {
    this.script = {
      kind: "events",
      events: [
        { type: "delta", text },
        { type: "done", finishReason: "stop" },
      ],
    };
    return this;
  }

  emitThenFail(text: string, code: "MODEL_UNAVAILABLE" = "MODEL_UNAVAILABLE", retryable = true): this {
    this.script = {
      kind: "events",
      events: [
        { type: "delta", text },
        { type: "error", code, retryable },
      ],
    };
    return this;
  }

  get cancelCallCount(): number {
    return this.cancelCount;
  }

  async openStream(request: ModelRouteRequest): Promise<{
    callId: string;
    stream: AsyncIterable<ModelStreamEvent>;
    cancel(): Promise<void>;
  }> {
    this.openCallCount += 1;
    this.lastRequest = request;
    const callId = `${this.name}-${this.openCallCount}`;
    if (this.script.kind === "throw") {
      throw {
        code: this.script.code,
        retryable: this.script.retryable,
        beforeFirstDelta: true,
        callId,
      };
    }
    const events = [...this.script.events];
    return {
      callId,
      stream: {
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      },
      cancel: async () => {
        this.cancelCount += 1;
      },
    };
  }
}

// ─── 测试夹具 ──────────────────────────────────────────────

function makeRequest(overrides: Partial<ModelRouteRequest> = {}): ModelRouteRequest {
  return {
    messages: [{ role: "user", content: "1+1=?" }],
    purpose: "AI_TUTORING",
    requiresVision: false,
    ...overrides,
  };
}

function makeRouter(): {
  primary: MockModelProvider;
  fallback: MockModelProvider;
  router: ModelRouter;
} {
  const primary = new MockModelProvider("primary");
  const fallback = new MockModelProvider("fallback");
  const router = new ModelRouter(primary, fallback);
  return { primary, fallback, router };
}

// ─── 测试用例 ──────────────────────────────────────────────

describe("ModelRouter", () => {
  describe("open", () => {
    it("uses primary when it emits a useful delta then completes", async () => {
      const { primary, router } = makeRouter();
      primary.succeed("解答：1+1=2");

      const handle = await router.open(makeRequest());

      expect(handle.route).toBe("primary");
      expect(handle.callId).toBe("primary-1");
      expect(handle.events).toEqual([
        { type: "delta", text: "解答：1+1=2" },
        { type: "done", finishReason: "stop" },
      ]);
    });

    it("falls back when primary fails before first delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.failBeforeFirstDelta();
      fallback.succeed("备用答案");

      const handle = await router.open(makeRequest());

      expect(handle.route).toBe("fallback");
      expect(handle.callId).toBe("fallback-1");
      expect(handle.events.map((e) => e.type)).toEqual(["delta", "done"]);
    });

    it("falls back when primary stream ends with error before any delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.emit({ type: "error", code: "MODEL_UNAVAILABLE", retryable: true });
      fallback.succeed("备用答案");

      const handle = await router.open(makeRequest());

      expect(handle.route).toBe("fallback");
    });

    it("falls back when primary stream ends with done but no delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.emit({ type: "done", finishReason: "stop" });
      fallback.succeed("备用答案");

      const handle = await router.open(makeRequest());

      expect(handle.route).toBe("fallback");
    });

    it("rejects with retryWithoutFallback when primary fails after emitting delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.emitThenFail("已生成");
      fallback.succeed("备用答案");

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryWithoutFallback: true,
        code: "MODEL_UNAVAILABLE",
      });
      // fallback must NOT be opened when primary already emitted delta
      expect(fallback.openCallCount).toBe(0);
    });

    it("rejects with retryWithoutFallback=false when primary fails before delta and no fallback configured", async () => {
      const primary = new MockModelProvider("primary");
      const router = new ModelRouter(primary, null);
      primary.failBeforeFirstDelta();

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryWithoutFallback: false,
        code: "MODEL_UNAVAILABLE",
      });
    });

    it("rejects when both primary and fallback fail before first delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.failBeforeFirstDelta();
      fallback.failBeforeFirstDelta();

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryable: false,
      });
    });

    it("rejects when primary fails before delta and fallback emits error before delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.failBeforeFirstDelta();
      fallback.emit({ type: "error", code: "MODEL_UNAVAILABLE", retryable: true });

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryable: false,
      });
    });

    it("exposes fallback events when primary fails before delta and fallback fails after delta", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.failBeforeFirstDelta();
      fallback.emitThenFail("备用第一个 delta");

      // Fallback is the last resort; if it also fails, router rejects.
      // The error carries events so stream-service can recover partial output.
      try {
        await router.open(makeRequest());
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ModelRouteError);
        const routeError = error as ModelRouteError;
        expect(routeError.events.map((e) => e.type)).toEqual(["delta", "error"]);
      }
    });

    it("does not synthesize fake text when both models fail", async () => {
      const { primary, fallback, router } = makeRouter();
      primary.failBeforeFirstDelta();
      fallback.failBeforeFirstDelta();

      try {
        await router.open(makeRequest());
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ModelRouteError);
        const routeError = error as ModelRouteError;
        expect(routeError.events).toEqual([]);
      }
    });

    it("forwards the same request to the chosen provider", async () => {
      const { primary, router } = makeRouter();
      primary.succeed();
      const request = makeRequest({ childId: "child-1", imageCount: 2, requiresVision: true });

      await router.open(request);

      expect(primary.lastRequest).toMatchObject({
        childId: "child-1",
        imageCount: 2,
        requiresVision: true,
      });
    });

    it("exposes collected events on the handle for primary route", async () => {
      const { primary, router } = makeRouter();
      primary.emit(
        { type: "delta", text: "第一段" },
        { type: "delta", text: "第二段" },
        { type: "done", finishReason: "length" },
      );

      const handle = await router.open(makeRequest());
      expect(handle.events).toEqual([
        { type: "delta", text: "第一段" },
        { type: "delta", text: "第二段" },
        { type: "done", finishReason: "length" },
      ]);
    });
  });

  describe("error classification", () => {
    it("marks primary-after-delta error as retryable when provider says so", async () => {
      const { primary, router } = makeRouter();
      primary.emitThenFail("部分答案", "MODEL_UNAVAILABLE", false);

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryWithoutFallback: true,
        retryable: false,
      });
    });

    it("marks no-fallback error with primary retryability", async () => {
      const primary = new MockModelProvider("primary");
      const router = new ModelRouter(primary, null);
      primary.failBeforeFirstDelta("MODEL_UNAVAILABLE", false);

      await expect(router.open(makeRequest())).rejects.toMatchObject({
        retryable: false,
        retryWithoutFallback: false,
      });
    });
  });
});

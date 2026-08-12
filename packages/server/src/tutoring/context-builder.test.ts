import { describe, expect, it } from "vitest";
import { buildContext, contextToSystemMessage, type BuildContextInput } from "./context-builder";

const baseInput: BuildContextInput = {
  publishedPromptContent: "You are a math tutor.",
  childProfileSummary: "7th grade, struggles with algebra.",
  currentTaskContent: "Help me solve 2x + 3 = 7",
  relevantHistory: [
    { summary: "Learned linear equations", createdAt: new Date("2026-01-01") },
  ],
  conversationMessages: [
    { role: "USER", content: "I don't understand how to isolate x" },
  ],
};

describe("buildContext", () => {
  it("builds context in the approved order", async () => {
    const parts = await buildContext(baseInput);
    expect(parts.map((p) => p.kind)).toEqual([
      "PLATFORM_SAFETY",
      "PUBLISHED_PROMPT",
      "CHILD_PROFILE",
      "CURRENT_TASK",
      "RELEVANT_HISTORY",
      "CURRENT_CONVERSATION",
    ]);
  });

  it("always returns exactly 6 parts even with empty data", async () => {
    const parts = await buildContext({
      publishedPromptContent: "",
      childProfileSummary: null,
      currentTaskContent: "",
      relevantHistory: [],
      conversationMessages: [],
    });
    expect(parts).toHaveLength(6);
  });

  it("includes hardcoded platform safety rules", async () => {
    const parts = await buildContext(baseInput);
    expect(parts[0].kind).toBe("PLATFORM_SAFETY");
    expect(parts[0].content).toContain("安全规则");
    expect(parts[0].content).toContain("不得");
  });

  it("includes the published prompt content as-is", async () => {
    const parts = await buildContext({ ...baseInput, publishedPromptContent: "Custom prompt" });
    expect(parts[1].kind).toBe("PUBLISHED_PROMPT");
    expect(parts[1].content).toBe("Custom prompt");
  });

  it("uses empty string when child profile is null", async () => {
    const parts = await buildContext({ ...baseInput, childProfileSummary: null });
    expect(parts[2].kind).toBe("CHILD_PROFILE");
    expect(parts[2].content).toBe("");
  });

  it("formats relevant history with date and summary", async () => {
    const parts = await buildContext({
      ...baseInput,
      relevantHistory: [
        { summary: "Learned fractions", createdAt: new Date("2026-03-01") },
        { summary: "Practiced decimals", createdAt: new Date("2026-03-05") },
      ],
    });
    expect(parts[4].kind).toBe("RELEVANT_HISTORY");
    expect(parts[4].content).toContain("Learned fractions");
    expect(parts[4].content).toContain("2026-03-01");
    expect(parts[4].content).toContain("Practiced decimals");
  });

  it("caps history at 5 entries", async () => {
    const parts = await buildContext({
      ...baseInput,
      relevantHistory: Array.from({ length: 10 }, (_, i) => ({
        summary: `Summary ${i}`,
        createdAt: new Date(2026, 0, i + 1),
      })),
    });
    const lines = parts[4].content.split("\n");
    expect(lines).toHaveLength(5);
  });

  it("formats conversation messages with role labels", async () => {
    const parts = await buildContext({
      ...baseInput,
      conversationMessages: [
        { role: "USER", content: "Hello" },
        { role: "ASSISTANT", content: "Hi there" },
      ],
    });
    expect(parts[5].kind).toBe("CURRENT_CONVERSATION");
    expect(parts[5].content).toContain("学生: Hello");
    expect(parts[5].content).toContain("辅导老师: Hi there");
  });

  it("caps conversation at last 20 messages", async () => {
    const parts = await buildContext({
      ...baseInput,
      conversationMessages: Array.from({ length: 30 }, (_, i) => ({
        role: "USER" as const,
        content: `Msg ${i}`,
      })),
    });
    const lines = parts[5].content.split("\n");
    expect(lines).toHaveLength(20);
    expect(parts[5].content).toContain("Msg 10");
    expect(parts[5].content).not.toContain("Msg 9");
  });
});

describe("contextToSystemMessage", () => {
  it("joins non-empty parts with separator", async () => {
    const parts = await buildContext(baseInput);
    const systemMessage = contextToSystemMessage(parts);
    expect(systemMessage).toContain("---");
    expect(systemMessage).toContain("You are a math tutor.");
    expect(systemMessage).toContain("安全规则");
  });

  it("skips empty parts", async () => {
    const parts = await buildContext({
      ...baseInput,
      childProfileSummary: null,
      relevantHistory: [],
      conversationMessages: [],
    });
    const systemMessage = contextToSystemMessage(parts);
    expect(systemMessage).not.toContain("---\n\n---");
  });
});

import { describe, expect, it, vi } from "vitest";
import { WrongQuestionService } from "./wrong-question-service";

describe("WrongQuestionService", () => {
  it("rejects fewer than one or more than nine child-owned files", async () => {
    const service = new WrongQuestionService({} as never, { listChildren: vi.fn().mockResolvedValue([{ id: "child" }]) }, {} as never);
    await expect(service.submit("user", { childId: "child", fileIds: [], idempotencyKey: "a" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(service.submit("user", { childId: "child", fileIds: Array.from({ length: 10 }, (_, i) => `f${i}`), idempotencyKey: "a" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

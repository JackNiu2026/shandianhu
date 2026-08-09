import { describe, expect, it, vi } from "vitest";
import { AssessmentAnalyzer } from "./assessment-analyze";

describe("AssessmentAnalyzer", () => {
  it("does not create evidence when model output is invalid", async () => {
    const database = { assessmentRun: { update: vi.fn() }, learningEvidence: { create: vi.fn() } };
    const processor = new AssessmentAnalyzer(database as never, { signGet: vi.fn() } as never, { complete: vi.fn().mockRejectedValue(new Error("schema invalid")) });
    await expect(processor.run({ runId: "run-1" })).resolves.toBeUndefined();
    expect(database.learningEvidence.create).not.toHaveBeenCalled();
    expect(database.assessmentRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
});

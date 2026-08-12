import { describe, expect, it, vi } from "vitest";
import { JobProcessingError } from "@lightning-tiger/server";
import { AssessmentAnalyzer, type AssessmentAnalyzerDatabase } from "./assessment-analyze";

const output = {
  questions: [{ ordinal: 1, recognizedText: "2 + 2 = 5", knowledgePoints: ["addition"], errorType: "CALCULATION" as const, analysis: "Arithmetic error", mastery: 30, suggestion: "Recheck addition" }],
  weakPoints: [{ name: "addition", mastery: 30 }],
  summary: "Review addition facts",
};

function createDatabase() {
  const transaction = {
    assessmentRun: {
      findUnique: vi.fn().mockResolvedValue({ id: "run-1", childId: "child-1", requestedByUserId: "user-1", artifacts: [{ ordinal: 1, fileObject: { id: "file-1", objectKey: "path/file-1" } }] }),
      update: vi.fn().mockResolvedValue({ id: "run-1" }),
    },
    assessmentResult: { upsert: vi.fn().mockResolvedValue({ id: "result-1" }) },
    learningEvidence: { upsert: vi.fn().mockResolvedValue({ id: "evidence-1" }) },
  };
  const database: AssessmentAnalyzerDatabase = {
    assessmentRun: transaction.assessmentRun,
    $transaction: vi.fn(async (operation) => operation(transaction)),
  };
  return { database, transaction };
}

describe("AssessmentAnalyzer", () => {
  it("uses signed GET urls and stores a schema-validated result, evidence, and succeeded run atomically", async () => {
    const { database, transaction } = createDatabase();
    const signer = { signGet: vi.fn().mockResolvedValue("https://cos.example/file-1") };
    const gateway = { complete: vi.fn().mockResolvedValue({ callId: "model-call-1", output }) };
    const analyzer = new AssessmentAnalyzer(database, signer, gateway);

    await expect(analyzer.run({ runId: "run-1" })).resolves.toEqual({ runId: "run-1", resultId: "result-1" });

    expect(signer.signGet).toHaveBeenCalledWith({ objectKey: "path/file-1", expiresInSeconds: 300 });
    expect(gateway.complete).toHaveBeenCalledWith(expect.objectContaining({
      childId: "child-1",
      userId: "user-1",
      imageCount: 1,
      schema: expect.any(Object),
      messages: expect.arrayContaining([expect.objectContaining({
        content: expect.arrayContaining([
          { type: "image_url", image_url: { url: "https://cos.example/file-1" } },
        ]),
      })]),
    }));
    expect(transaction.assessmentResult.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ modelUsageLedgerId: "model-call-1", result: output }) }));
    expect(transaction.learningEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ childId: "child-1", assessmentRunId: "run-1", source: "ASSESSMENT", sourceId: "run-1" }) }));
    expect(transaction.assessmentRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED" }) }));
  });

  it("marks the run failed and throws a terminal job error when analysis fails without creating evidence", async () => {
    const { database, transaction } = createDatabase();
    const analyzer = new AssessmentAnalyzer(database, { signGet: vi.fn().mockResolvedValue("https://cos.example/file-1") }, { complete: vi.fn().mockRejectedValue(new Error("schema invalid")) });

    await expect(analyzer.run({ runId: "run-1" })).rejects.toBeInstanceOf(JobProcessingError);
    expect(transaction.learningEvidence.upsert).not.toHaveBeenCalled();
    expect(transaction.assessmentRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
});

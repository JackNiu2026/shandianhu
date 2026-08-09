import { describe, expect, it, vi } from "vitest";
import { LEARNING_STYLE_QUESTIONS } from "./learning-style";
import { LearningStyleAssessmentService } from "./assessment-service";

const answers = LEARNING_STYLE_QUESTIONS.map((question) => ({ questionId: question.id, option: "A" as const }));

describe("LearningStyleAssessmentService", () => {
  it("creates a deterministic result, one assessment evidence record, and a profile job", async () => {
    const created: Record<string, unknown>[] = [];
    const database = {
      assessmentVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: "version-1" }),
      },
      assessmentRun: {
        upsert: vi.fn().mockImplementation(async ({ create }) => ({ id: "run-1", ...create })),
      },
      assessmentResult: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          created.push(create);
          return { id: "result-1", ...create };
        }),
      },
      learningEvidence: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          created.push(create);
          return { id: "evidence-1", ...create };
        }),
      },
    };
    const children = { listChildren: vi.fn().mockResolvedValue([{ id: "child-1" }]) };
    const jobs = { enqueue: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const service = new LearningStyleAssessmentService(database, children, jobs);

    const submitted = await service.submit("user-1", {
      childId: "child-1",
      idempotencyKey: "style-1",
      answers,
    });

    expect(submitted).toEqual({ runId: "run-1", resultId: "result-1", taskId: "job-1", code: "ESTJ" });
    expect(created).toEqual(expect.arrayContaining([
      expect.objectContaining({ assessmentRunId: "run-1", result: expect.objectContaining({ code: "ESTJ" }) }),
      expect.objectContaining({ childId: "child-1", source: "ASSESSMENT", sourceId: "run-1" }),
    ]));
    expect(jobs.enqueue).toHaveBeenCalledWith(
      "PROFILE_GENERATION",
      "learning-style:run-1:profile",
      { childId: "child-1", assessmentRunId: "run-1" },
      "user-1",
    );
  });
});

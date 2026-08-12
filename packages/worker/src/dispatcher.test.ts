import { describe, expect, it, vi } from "vitest";
import { JobProcessingError } from "@lightning-tiger/server";
import { createDispatcher } from "./dispatcher";

describe("createDispatcher", () => {
  const assessmentAnalyzer = { run: vi.fn().mockResolvedValue({ runId: "run-1", resultId: "result-1" }) };
  const profileRebuild = { run: vi.fn().mockResolvedValue({ id: "version-1", learningProfileId: "profile-1" }) };
  const reportPdf = { run: vi.fn().mockResolvedValue({ fileId: "file-1" }) };

  function makeDispatcher() {
    assessmentAnalyzer.run.mockClear();
    profileRebuild.run.mockClear();
    reportPdf.run.mockClear();
    return createDispatcher({ assessmentAnalyzer, profileRebuild, reportPdf });
  }

  it("routes ASSESSMENT_PROCESSING to the assessment analyzer with runId", async () => {
    const dispatcher = makeDispatcher();
    await dispatcher.process({ id: "job-1", type: "ASSESSMENT_PROCESSING", payload: { runId: "run-1" } });
    expect(assessmentAnalyzer.run).toHaveBeenCalledWith({ runId: "run-1" });
    expect(profileRebuild.run).not.toHaveBeenCalled();
    expect(reportPdf.run).not.toHaveBeenCalled();
  });

  it("routes PROFILE_GENERATION to the profile rebuild processor with childId", async () => {
    const dispatcher = makeDispatcher();
    await dispatcher.process({ id: "job-2", type: "PROFILE_GENERATION", payload: { childId: "child-1" } });
    expect(profileRebuild.run).toHaveBeenCalledWith({ childId: "child-1" });
    expect(assessmentAnalyzer.run).not.toHaveBeenCalled();
    expect(reportPdf.run).not.toHaveBeenCalled();
  });

  it("routes REPORT_GENERATION to the report PDF processor with reportId", async () => {
    const dispatcher = makeDispatcher();
    await dispatcher.process({ id: "job-3", type: "REPORT_GENERATION", payload: { reportId: "report-1" } });
    expect(reportPdf.run).toHaveBeenCalledWith({ reportId: "report-1" });
    expect(assessmentAnalyzer.run).not.toHaveBeenCalled();
    expect(profileRebuild.run).not.toHaveBeenCalled();
  });

  it("rejects FILE_PROCESSING as a terminal error (handled by scheduled cleanup)", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-4", type: "FILE_PROCESSING", payload: {} }),
    ).rejects.toMatchObject({
      name: "JobProcessingError",
      code: "FILE_CORRUPT",
    });
    expect(assessmentAnalyzer.run).not.toHaveBeenCalled();
    expect(profileRebuild.run).not.toHaveBeenCalled();
    expect(reportPdf.run).not.toHaveBeenCalled();
  });

  it("rejects ASSESSMENT_PROCESSING missing runId with FILE_CORRUPT", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-5", type: "ASSESSMENT_PROCESSING", payload: {} }),
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
    expect(assessmentAnalyzer.run).not.toHaveBeenCalled();
  });

  it("rejects PROFILE_GENERATION missing childId with FILE_CORRUPT", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-6", type: "PROFILE_GENERATION", payload: {} }),
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
    expect(profileRebuild.run).not.toHaveBeenCalled();
  });

  it("rejects REPORT_GENERATION missing reportId with FILE_CORRUPT", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-7", type: "REPORT_GENERATION", payload: {} }),
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
    expect(reportPdf.run).not.toHaveBeenCalled();
  });

  it("terminates TUTORING_SUMMARY because the current data model does not support it", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-summary", type: "TUTORING_SUMMARY", payload: { conversationId: "conversation-1" } }),
    ).rejects.toMatchObject({
      name: "JobProcessingError",
      code: "MODEL_SCHEMA_INVALID",
    });
    expect(assessmentAnalyzer.run).not.toHaveBeenCalled();
    expect(profileRebuild.run).not.toHaveBeenCalled();
    expect(reportPdf.run).not.toHaveBeenCalled();
  });

  it("rejects unknown job types with FILE_CORRUPT", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatcher.process({ id: "job-8", type: "UNKNOWN_TYPE" as any, payload: {} }),
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
  });

  it("treats non-object payload as empty (missing fields become FILE_CORRUPT)", async () => {
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.process({ id: "job-9", type: "ASSESSMENT_PROCESSING", payload: null as unknown as Record<string, string> }),
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
  });

  it("returns the processor result to the caller", async () => {
    const dispatcher = makeDispatcher();
    const result = await dispatcher.process({ id: "job-10", type: "REPORT_GENERATION", payload: { reportId: "report-1" } });
    expect(result).toEqual({ fileId: "file-1" });
  });

  it("produces JobProcessingError instances (not generic Errors) for terminal failures", async () => {
    const dispatcher = makeDispatcher();
    try {
      await dispatcher.process({ id: "job-11", type: "FILE_PROCESSING", payload: {} });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(JobProcessingError);
    }
  });
});

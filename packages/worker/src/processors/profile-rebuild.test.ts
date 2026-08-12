import { describe, expect, it, vi } from "vitest";
import { ProfileRebuildProcessor } from "./profile-rebuild";

describe("ProfileRebuildProcessor", () => {
  it("delegates rebuilding to the profile service for the requested child", async () => {
    const profiles = { rebuild: vi.fn().mockResolvedValue({ id: "version-1", learningProfileId: "profile-1" }) };
    const processor = new ProfileRebuildProcessor(profiles);

    await expect(processor.run({ childId: "child-1" })).resolves.toEqual({ id: "version-1", learningProfileId: "profile-1" });
    expect(profiles.rebuild).toHaveBeenCalledWith("child-1");
  });

  it("creates a report and enqueues a REPORT_GENERATION job after rebuild", async () => {
    const profiles = { rebuild: vi.fn().mockResolvedValue({ id: "version-1", learningProfileId: "profile-1" }) };
    const reports = { findOrCreateForProfile: vi.fn().mockResolvedValue({ id: "report-1" }) };
    const reportJobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const processor = new ProfileRebuildProcessor(profiles, reports, reportJobs);

    await processor.run({ childId: "child-1" });

    expect(reports.findOrCreateForProfile).toHaveBeenCalledWith("profile-1", "version-1");
    expect(reportJobs.enqueue).toHaveBeenCalledWith("REPORT_GENERATION", "report:report-1:pdf", { reportId: "report-1" });
  });

  it("reuses the same report and dedupeKey when rebuild retries (idempotent enqueue)", async () => {
    const profiles = { rebuild: vi.fn().mockResolvedValue({ id: "version-1", learningProfileId: "profile-1" }) };
    // findOrCreateForProfile 返回同一个 report，模拟幂等查找命中
    const reports = { findOrCreateForProfile: vi.fn().mockResolvedValue({ id: "report-1" }) };
    const reportJobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const processor = new ProfileRebuildProcessor(profiles, reports, reportJobs);

    await processor.run({ childId: "child-1" });
    await processor.run({ childId: "child-1" });

    // 两次 rebuild 都查找/创建同一个 report（基于 versionId 幂等）
    expect(reports.findOrCreateForProfile).toHaveBeenCalledTimes(2);
    expect(reports.findOrCreateForProfile).toHaveBeenNthCalledWith(1, "profile-1", "version-1");
    expect(reports.findOrCreateForProfile).toHaveBeenNthCalledWith(2, "profile-1", "version-1");
    // 两次 enqueue 使用相同 dedupeKey，JobService 的 upsert 会去重
    expect(reportJobs.enqueue).toHaveBeenCalledTimes(2);
    expect(reportJobs.enqueue).toHaveBeenNthCalledWith(1, "REPORT_GENERATION", "report:report-1:pdf", { reportId: "report-1" });
    expect(reportJobs.enqueue).toHaveBeenNthCalledWith(2, "REPORT_GENERATION", "report:report-1:pdf", { reportId: "report-1" });
  });

  it("does not enqueue report when reports or reportJobs are not injected (backward compatible)", async () => {
    const profiles = { rebuild: vi.fn().mockResolvedValue({ id: "version-1", learningProfileId: "profile-1" }) };
    const processor = new ProfileRebuildProcessor(profiles);

    const result = await processor.run({ childId: "child-1" });
    expect(result).toEqual({ id: "version-1", learningProfileId: "profile-1" });
  });
});

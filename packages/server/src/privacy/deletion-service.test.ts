import { describe, expect, it, vi } from "vitest";
import { PrivacyDeletionService } from "./deletion-service";

describe("PrivacyDeletionService", () => {
  it("revokes dependent evidence and report shares when a parent deletes an assessment image", async () => {
    const fileUpdate = vi.fn().mockResolvedValue({ id: "file-1" });
    const evidenceUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const sharesUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      parentProfile: { findUnique: vi.fn().mockResolvedValue({ id: "parent-profile-1", userId: "parent-1", activeChildId: "child-1" }) },
      child: { findUnique: vi.fn().mockResolvedValue({ id: "child-1", parentProfileId: "parent-profile-1", deletedAt: null }), update: vi.fn() },
      fileObject: { findUnique: vi.fn().mockResolvedValue({ id: "file-1", ownerUserId: "parent-1", parentProfileId: "parent-profile-1", childId: "child-1", status: "ACTIVE", deletedAt: null, revokedAt: null }), update: fileUpdate },
      assessmentArtifact: { findMany: vi.fn().mockResolvedValue([{ assessmentRunId: "run-1" }]) },
      learningEvidence: { updateMany: evidenceUpdate },
      learningReport: { findMany: vi.fn().mockResolvedValue([{ id: "report-1" }]) },
      reportShare: { updateMany: sharesUpdate },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const jobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new PrivacyDeletionService(database, jobs, () => new Date("2026-08-09T00:00:00.000Z"));

    await service.deleteAssessmentSource("parent-1", "file-1");

    expect(fileUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELETED", deletedAt: new Date("2026-08-09T00:00:00.000Z") }) }));
    expect(evidenceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { childId: "child-1", assessmentRunId: { in: ["run-1"] }, revokedAt: null },
    }));
    expect(sharesUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { learningReportId: { in: ["report-1"] }, revokedAt: null },
    }));
    expect(jobs.enqueue).toHaveBeenCalledWith("PROFILE_GENERATION", "privacy:file-1:profile", { childId: "child-1" }, "parent-1");
  });

  it("makes a child unavailable immediately and allows recovery only within 30 days", async () => {
    const update = vi.fn().mockResolvedValue({ id: "child-1" });
    const transaction = {
      parentProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "parent-profile-1", userId: "parent-1", activeChildId: "child-1" }),
        update: vi.fn().mockResolvedValue({ id: "parent-profile-1" }),
      },
      child: {
        findUnique: vi.fn().mockResolvedValue({ id: "child-1", parentProfileId: "parent-profile-1", deletedAt: null, purgeAfter: null }),
        update,
      },
      fileObject: { findUnique: vi.fn(), update: vi.fn() },
      assessmentArtifact: { findMany: vi.fn() },
      learningEvidence: { updateMany: vi.fn() },
      learningReport: { findMany: vi.fn() },
      reportShare: { updateMany: vi.fn() },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const service = new PrivacyDeletionService(database, { enqueue: vi.fn() }, () => new Date("2026-08-09T00:00:00.000Z"));

    await service.softDeleteChild("parent-1", "child-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletedAt: new Date("2026-08-09T00:00:00.000Z"), purgeAfter: new Date("2026-09-08T00:00:00.000Z") },
    }));

    transaction.child.findUnique.mockResolvedValue({
      id: "child-1", parentProfileId: "parent-profile-1", deletedAt: new Date("2026-08-09T00:00:00.000Z"), purgeAfter: new Date("2026-09-08T00:00:00.000Z"),
    });
    await service.restoreChild("parent-1", "child-1");
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deletedAt: null, purgeAfter: null } }));
  });
});

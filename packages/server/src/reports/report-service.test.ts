import { describe, expect, it, vi } from "vitest";
import { ReportService } from "./report-service";

describe("ReportService", () => {
  it("builds a fact-only initial report from one completed assessment profile", async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: "report-1", ...data }));
    const database = {
      learningProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "profile-1",
          childId: "child-1",
          currentVersionId: "profile-version-1",
        }),
      },
      learningProfileVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: "profile-version-1",
          learningProfileId: "profile-1",
          version: 1,
          revokedAt: null,
          snapshot: { evidenceIds: ["evidence-style-1"], evidenceCount: 1, confidence: 0.62 },
          confidenceBasis: { score: 0.62 },
        }),
      },
      learningReport: { count: vi.fn().mockResolvedValue(0), create },
    };
    const reports = new ReportService(database);

    const report = await reports.createForProfile("profile-1");

    expect(report).toMatchObject({
      id: "report-1",
      childId: "child-1",
      learningProfileVersionId: "profile-version-1",
      sequence: 1,
      body: {
        evidenceCount: 1,
        evidenceIds: ["evidence-style-1"],
        confidence: 0.62,
      },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "DRAFT",
        narrativeVersion: "facts-v1",
        body: expect.not.objectContaining({ schoolName: expect.anything(), phone: expect.anything() }),
      }),
    }));
  });

  it("does not create a report when the current profile version has been revoked", async () => {
    const database = {
      learningProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1", childId: "child-1", currentVersionId: "profile-version-1" }) },
      learningProfileVersion: { findUnique: vi.fn().mockResolvedValue({ id: "profile-version-1", learningProfileId: "profile-1", revokedAt: new Date() }) },
      learningReport: { count: vi.fn(), create: vi.fn() },
    };

    await expect(new ReportService(database).createForProfile("profile-1"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(database.learningReport.create).not.toHaveBeenCalled();
  });

  it("does not disclose a report outside the owning parent account", async () => {
    const database = {
      learningProfile: { findUnique: vi.fn() },
      learningProfileVersion: { findUnique: vi.fn() },
      learningReport: {
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          id: "report-1",
          status: "READY",
          child: { parentProfile: { userId: "parent-1" } },
        }),
      },
    };

    await expect(new ReportService(database).getForUser("parent-2", "report-1"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

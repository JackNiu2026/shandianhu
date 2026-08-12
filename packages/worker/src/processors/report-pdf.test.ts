import { describe, expect, it, vi } from "vitest";
import { buildRedactedReportText, PdfKitRenderer, ReportPdfProcessor } from "./report-pdf";

describe("buildRedactedReportText", () => {
  it("renders only the child's first-character name, grade and report facts", () => {
    const text = buildRedactedReportText({
      childName: "王小明",
      grade: "三年级",
      schoolName: "示例实验小学",
      parentPhone: "13800138000",
      objectKey: "families/private/wrong-question.jpg",
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      body: { evidenceCount: 1, confidence: 0.62, evidenceIds: ["evidence-1"], latestObservedAt: null },
    });

    expect(text).toContain("王同学");
    expect(text).toContain("三年级");
    expect(text).toContain("证据数量：1");
    expect(text).not.toContain("王小明");
    expect(text).not.toContain("示例实验小学");
    expect(text).not.toContain("13800138000");
    expect(text).not.toContain("families/private/wrong-question.jpg");
  });

  it("persists a private PDF and marks the report ready only after upload", async () => {
    const create = vi.fn().mockResolvedValue({ id: "file-1" });
    const update = vi.fn().mockResolvedValue({ id: "report-1" });
    const transaction = { fileObject: { create }, learningReport: { update } };
    const database = {
      learningReport: {
        findUnique: vi.fn().mockResolvedValue({
          id: "report-1",
          childId: "child-1",
          status: "DRAFT",
          body: { evidenceCount: 1, confidence: 0.62, evidenceIds: ["evidence-1"], latestObservedAt: null },
          child: { name: "王小明", grade: "三年级", parentProfile: { id: "profile-1", userId: "parent-1" } },
        }),
      },
      $transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const storage = { put: vi.fn().mockResolvedValue(undefined) };
    const renderer = { render: vi.fn().mockResolvedValue(Buffer.from("pdf")) };
    const processor = new ReportPdfProcessor(database, storage, renderer, {
      createId: () => "file-1",
      clock: () => new Date("2026-08-09T00:00:00.000Z"),
    });

    await expect(processor.run({ reportId: "report-1" })).resolves.toEqual({ fileId: "file-1" });
    expect(storage.put).toHaveBeenCalledWith(expect.objectContaining({
      objectKey: "reports/child-1/file-1.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        id: "file-1",
        ownerUserId: "parent-1",
        childId: "child-1",
        purpose: "REPORT_EXPORT",
        visibility: "PRIVATE",
        status: "ACTIVE",
      }),
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "report-1" },
      data: expect.objectContaining({ fileObjectId: "file-1", status: "READY" }),
    }));
  });

  it("loads the bundled Chinese font when producing a real PDF", async () => {
    const body = await new PdfKitRenderer().render("学生：王同学\n学习情况报告");

    expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(body.byteLength).toBeGreaterThan(512);
  });
});

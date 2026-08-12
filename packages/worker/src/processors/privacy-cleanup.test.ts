import { describe, expect, it, vi } from "vitest";
import { PrivacyCleanupProcessor } from "./privacy-cleanup";

describe("PrivacyCleanupProcessor", () => {
  it("removes expired child objects and redacts assessment bodies while retaining a tombstone", async () => {
    const storage = { remove: vi.fn().mockResolvedValue(undefined) };
    const transaction = {
      fileObject: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assessmentArtifact: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assessmentResult: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      learningEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      learningProfile: { findMany: vi.fn().mockResolvedValue([{ id: "profile-1" }]), update: vi.fn().mockResolvedValue({ id: "profile-1" }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      learningProfileVersionEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      learningProfileVersion: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      reportShare: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      learningReport: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assessmentRun: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      child: { update: vi.fn().mockResolvedValue({ id: "child-1" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    };
    const database = {
      child: { findMany: vi.fn().mockResolvedValue([{ id: "child-1" }]) },
      fileObject: { findMany: vi.fn().mockResolvedValue([{ id: "file-1", objectKey: "families/child-1/source.jpg" }]) },
      $transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const processor = new PrivacyCleanupProcessor(database, storage, () => new Date("2026-09-09T00:00:00.000Z"));

    await expect(processor.run()).resolves.toEqual({ purgedChildren: 1, removedFiles: 1 });
    expect(storage.remove).toHaveBeenCalledWith("families/child-1/source.jpg");
    expect(transaction.learningEvidence.deleteMany).toHaveBeenCalledWith({ where: { childId: "child-1" } });
    expect(transaction.child.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "child-1" },
      data: expect.objectContaining({ name: "已删除", birthDate: null, schoolName: null, learningGoals: [], purgeAfter: null }),
    }));
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorKind: "SYSTEM", entityType: "CHILD", entityId: "child-1", action: "DELETE", sanitizedDiff: { purged: true } }),
    }));
  });
});

import { describe, expect, it, vi } from "vitest";
import { WrongQuestionService, type WrongQuestionDatabase } from "./wrong-question-service";

const version = { id: "version-1" };
const ownedChild = { id: "child-1", parentProfileId: "family-1", deletedAt: null };
const activeFiles = ["file-1", "file-2"].map((id) => ({
  id,
  ownerUserId: "user-1",
  parentProfileId: "family-1",
  childId: "child-1",
  status: "ACTIVE" as const,
  deletedAt: null,
  revokedAt: null,
}));

function createDatabase() {
  const run = { id: "run-1" };
  const transaction = {
    parentProfile: { findUnique: vi.fn().mockResolvedValue({ id: "family-1", userId: "user-1" }) },
    child: { findUnique: vi.fn().mockResolvedValue(ownedChild) },
    fileObject: { findMany: vi.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) => Promise.resolve(activeFiles.filter((file) => where.id.in.includes(file.id)))) },
    assessmentVersion: { findFirst: vi.fn().mockResolvedValue(version) },
    assessmentRun: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(run),
    },
    assessmentArtifact: { create: vi.fn().mockResolvedValue({ id: "artifact" }) },
    asyncJob: {
      upsert: vi.fn().mockResolvedValue({ id: "task-1", availableAt: new Date("2026-08-09T00:00:00.000Z") }),
    },
  };
  const database: WrongQuestionDatabase = {
    $transaction: vi.fn(async (operation) => operation(transaction)),
  };
  return { database, transaction };
}

describe("WrongQuestionService", () => {
  it("rejects submissions outside the one to nine image limit before persistence", async () => {
    const { database } = createDatabase();
    const service = new WrongQuestionService(database, { enqueuePersisted: vi.fn() });

    await expect(service.submit("user-1", { childId: "child-1", fileIds: [], idempotencyKey: "key" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(service.submit("user-1", { childId: "child-1", fileIds: Array.from({ length: 10 }, (_, index) => `file-${index}`), idempotencyKey: "key" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("requires an active owned child and active files bound to that child", async () => {
    const { database, transaction } = createDatabase();
    transaction.fileObject.findMany.mockResolvedValue([activeFiles[0]]);
    const service = new WrongQuestionService(database, { enqueuePersisted: vi.fn() });

    await expect(service.submit("user-1", { childId: "child-1", fileIds: ["file-1", "file-2"], idempotencyKey: "key" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(transaction.fileObject.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["file-1", "file-2"] },
        ownerUserId: "user-1",
        parentProfileId: "family-1",
        childId: "child-1",
        status: "ACTIVE",
        deletedAt: null,
        revokedAt: null,
      },
    });
  });

  it("persists versioned ordered artifacts and its deduped task in one transaction", async () => {
    const { database, transaction } = createDatabase();
    const enqueuePersisted = vi.fn().mockResolvedValue(undefined);
    const service = new WrongQuestionService(database, { enqueuePersisted });

    await expect(service.submit("user-1", { childId: "child-1", fileIds: ["file-2", "file-1"], idempotencyKey: "key" }))
      .resolves.toEqual({ runId: "run-1", taskId: "task-1" });

    expect(transaction.assessmentVersion.findFirst).toHaveBeenCalledWith({
      where: { status: "PUBLISHED", definition: { slug: "wrong-question" } },
      orderBy: [{ version: "desc" }, { id: "asc" }],
    });
    expect(transaction.assessmentRun.create).toHaveBeenCalledWith({ data: expect.objectContaining({ assessmentVersionId: "version-1" }) });
    expect(transaction.assessmentArtifact.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ fileObjectId: "file-2", ordinal: 1 }) });
    expect(transaction.assessmentArtifact.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ fileObjectId: "file-1", ordinal: 2 }) });
    expect(transaction.asyncJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: "wrong-questions:run-1" },
      create: expect.objectContaining({ childId: "child-1", assessmentRunId: "run-1" }),
      update: {},
    }));
    expect(enqueuePersisted).toHaveBeenCalledWith("task-1", expect.any(Date));
  });

  it("returns the original run and task without replacing artifacts for the same idempotency key", async () => {
    const { database, transaction } = createDatabase();
    transaction.assessmentRun.findUnique.mockResolvedValue({ id: "existing-run" });
    transaction.asyncJob.upsert.mockResolvedValue({ id: "existing-task", availableAt: new Date("2026-08-09T00:00:00.000Z") });
    const service = new WrongQuestionService(database, { enqueuePersisted: vi.fn().mockResolvedValue(undefined) });

    await expect(service.submit("user-1", { childId: "child-1", fileIds: ["file-2"], idempotencyKey: "same-key" }))
      .resolves.toEqual({ runId: "existing-run", taskId: "existing-task" });
    expect(transaction.assessmentArtifact.create).not.toHaveBeenCalled();
    expect(transaction.assessmentVersion.findFirst).not.toHaveBeenCalled();
  });
});

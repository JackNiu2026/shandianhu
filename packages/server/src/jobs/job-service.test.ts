import { describe, expect, it, vi } from "vitest";
import {
  JobProcessingError,
  JobService,
  type AsyncJobRecord,
  type JobDatabase,
  type JobQueue,
} from "./job-service";

function job(overrides: Partial<AsyncJobRecord> = {}): AsyncJobRecord {
  return {
    id: "job-1",
    requestedByUserId: "user-1",
    type: "ASSESSMENT_PROCESSING",
    dedupeKey: "run:1",
    status: "PENDING",
    attempt: 0,
    maxAttempts: 3,
    retryAt: null,
    availableAt: new Date("2026-08-09T00:00:00.000Z"),
    payload: { runId: "1" },
    result: null,
    errorCode: null,
    errorDetail: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function createDatabase(records: AsyncJobRecord[] = []): JobDatabase & { updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    asyncJob: {
      upsert: vi.fn(async ({ where, create }) => {
        const existing = records.find((record) => record.dedupeKey === where.dedupeKey);
        if (existing) return existing;
        const created = job({ ...create, id: `job-${records.length + 1}` });
        records.push(created);
        return created;
      }),
      findUnique: vi.fn(async ({ where }) => records.find((record) => record.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }) => records.filter((record) =>
        where.status === "PENDING" && record.availableAt <= where.availableAt.lte,
      )),
      update: vi.fn(async ({ where, data }) => {
        const record = records.find((candidate) => candidate.id === where.id);
        if (!record) throw new Error("job not found");
        Object.assign(record, data);
        updates.push(data);
        return record;
      }),
    },
  };
}

function createQueue(): JobQueue {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
  };
}

describe("JobService", () => {
  it("creates one database job for one dedupe key", async () => {
    const database = createDatabase();
    const queue = createQueue();
    const jobs = new JobService(database, queue);

    const first = await jobs.enqueue("ASSESSMENT_PROCESSING", "run:1", { runId: "1" }, "user-1");
    const second = await jobs.enqueue("ASSESSMENT_PROCESSING", "run:1", { runId: "1" }, "user-1");

    expect(second.id).toBe(first.id);
    expect(database.asyncJob.upsert).toHaveBeenCalledTimes(2);
    expect(queue.enqueue).toHaveBeenCalledWith(first.id, { delayMs: 0 });
  });

  it("records transient retry transitions before re-enqueuing a pending job", async () => {
    const database = createDatabase([job()]);
    const queue = createQueue();
    const now = new Date("2026-08-09T00:00:00.000Z");
    const jobs = new JobService(database, queue, { now: () => now, retryDelayMs: 1_000 });

    await jobs.start("job-1");
    await jobs.fail("job-1", new Error("network timeout"));

    expect(database.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "RUNNING", attempt: 1 }),
      expect.objectContaining({ status: "RETRY_WAIT", retryAt: new Date("2026-08-09T00:00:01.000Z") }),
      expect.objectContaining({ status: "PENDING", availableAt: new Date("2026-08-09T00:00:01.000Z") }),
    ]));
    expect(queue.enqueue).toHaveBeenCalledWith("job-1", { delayMs: 1_000 });
  });

  it("fails permanent work and dead-letters exhausted transient work", async () => {
    const permanentDatabase = createDatabase([job({ status: "RUNNING", attempt: 1 })]);
    const permanentJobs = new JobService(permanentDatabase, createQueue());

    await permanentJobs.fail("job-1", new JobProcessingError("FILE_CORRUPT", "file cannot be read"));
    expect(permanentDatabase.updates).toContainEqual(expect.objectContaining({ status: "FAILED", errorCode: "FILE_CORRUPT" }));

    const exhaustedDatabase = createDatabase([job({ status: "RUNNING", attempt: 3 })]);
    const exhaustedJobs = new JobService(exhaustedDatabase, createQueue());
    await exhaustedJobs.fail("job-1", new Error("temporary failure"));

    expect(exhaustedDatabase.updates).toContainEqual(expect.objectContaining({ status: "DEAD_LETTER" }));
  });

  it("requeues pending database jobs absent from Redis", async () => {
    const database = createDatabase([job()]);
    const queue = createQueue();
    const jobs = new JobService(database, queue, { now: () => new Date("2026-08-09T00:00:00.000Z") });

    await jobs.reconcile();

    expect(queue.has).toHaveBeenCalledWith("job-1");
    expect(queue.enqueue).toHaveBeenCalledWith("job-1", { delayMs: 0 });
  });
});

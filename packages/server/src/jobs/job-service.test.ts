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
      findMany: vi.fn(async ({ where }) => records.filter((record) => {
        const statuses = typeof where.status === "string" ? [where.status] : where.status.in;
        const dueAt = record.status === "RETRY_WAIT" ? record.retryAt : record.availableAt;
        return statuses.includes(record.status) && Boolean(dueAt);
      })),
      update: vi.fn(async ({ where, data }) => {
        const record = records.find((candidate) => candidate.id === where.id);
        if (!record) throw new Error("job not found");
        Object.assign(record, data);
        updates.push(data);
        return record;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const record = records.find((candidate) => candidate.id === where.id);
        const dueAt = record?.status === "RETRY_WAIT" ? record.retryAt : record?.availableAt;
        if (
          !record
          || record.status !== where.status
          || (where.dueAt && (!dueAt || dueAt > where.dueAt.lte))
        ) {
          return { count: 0 };
        }
        Object.assign(record, data);
        updates.push(data);
        return { count: 1 };
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

  it("records transient retry state and claims it again only after it becomes due", async () => {
    const database = createDatabase([job()]);
    const queue = createQueue();
    let now = new Date("2026-08-09T00:00:00.000Z");
    const jobs = new JobService(database, queue, { now: () => now, retryDelayMs: 1_000 });

    await jobs.start("job-1");
    await jobs.fail("job-1", new Error("network timeout"));

    expect(database.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "RUNNING", attempt: 1 }),
      expect.objectContaining({ status: "RETRY_WAIT", retryAt: new Date("2026-08-09T00:00:01.000Z") }),
    ]));
    expect(queue.enqueue).not.toHaveBeenCalled();

    now = new Date("2026-08-09T00:00:01.000Z");
    await jobs.start("job-1");

    expect(database.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "PENDING", availableAt: now }),
      expect.objectContaining({ status: "RUNNING", attempt: 2 }),
    ]));
  });

  it("atomically grants at most one concurrent pending claim", async () => {
    const database = createDatabase([job()]);
    const jobs = new JobService(database, createQueue(), { now: () => new Date("2026-08-09T00:00:00.000Z") });
    let releaseReads: () => void;
    const bothReads = new Promise<void>((resolve) => { releaseReads = resolve; });
    let reads = 0;
    (database.asyncJob.findUnique as unknown as {
      mockImplementation: (implementation: (input: { where: { id: string } }) => Promise<AsyncJobRecord | null>) => void;
    }).mockImplementation(async (input) => {
      if (input.where.id === "job-1" && reads++ < 2) {
        await bothReads;
        return job();
      }
      return job({ status: "RUNNING", attempt: 1 });
    });

    const claimsPromise = Promise.all([jobs.start("job-1"), jobs.start("job-1")]);
    await Promise.resolve();
    expect(reads).toBe(2);
    releaseReads!();
    const claims = await claimsPromise;

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ status: "RUNNING", attempt: 1 });
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

  it("requeues pending and retry-wait database jobs absent from Redis", async () => {
    const now = new Date("2026-08-09T00:00:00.000Z");
    const database = createDatabase([
      job({ id: "pending-now" }),
      job({
        id: "pending-later",
        dedupeKey: "later",
        availableAt: new Date("2026-08-09T00:01:00.000Z"),
      }),
      job({
        id: "retry-later",
        dedupeKey: "retry",
        status: "RETRY_WAIT",
        retryAt: new Date("2026-08-09T00:00:30.000Z"),
      }),
    ]);
    const queue = createQueue();
    const jobs = new JobService(database, queue, { now: () => now });

    await jobs.reconcile();

    expect(queue.enqueue).toHaveBeenCalledWith("pending-now", { delayMs: 0 });
    expect(queue.enqueue).toHaveBeenCalledWith("pending-later", { delayMs: 60_000 });
    expect(queue.enqueue).toHaveBeenCalledWith("retry-later", { delayMs: 30_000 });
  });
});

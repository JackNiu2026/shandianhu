import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { BullMqJobQueue, type JobQueue } from "./queue";

export type AsyncJobType =
  | "ASSESSMENT_PROCESSING"
  | "PROFILE_GENERATION"
  | "REPORT_GENERATION"
  | "FILE_PROCESSING"
  | "TUTORING_SUMMARY";

export type AsyncJobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "RETRY_WAIT"
  | "SUCCEEDED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED";

export type AsyncJobRecord = {
  id: string;
  requestedByUserId: string | null;
  childId?: string | null;
  assessmentRunId?: string | null;
  type: AsyncJobType;
  dedupeKey: string;
  status: AsyncJobStatus;
  attempt: number;
  maxAttempts: number;
  retryAt: Date | null;
  availableAt: Date;
  payload: unknown;
  result: unknown;
  errorCode: string | null;
  errorDetail: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type JobClaimWhere =
  | { id: string; status: "PENDING"; availableAt: { lte: Date } }
  | { id: string; status: "RETRY_WAIT"; retryAt: { lte: Date } };

type JobCreateInput = Omit<AsyncJobRecord, "id" | "result" | "errorCode" | "errorDetail" | "startedAt" | "finishedAt">;

export interface JobDatabase {
  asyncJob: {
    upsert(args: {
      where: { dedupeKey: string };
      create: JobCreateInput;
      update: Record<string, never>;
    }): Promise<AsyncJobRecord>;
    findUnique(args: { where: { id: string } }): Promise<AsyncJobRecord | null>;
    findMany(args: {
      where: { status: { in: Array<"PENDING" | "RETRY_WAIT"> } };
    }): Promise<AsyncJobRecord[]>;
    update(args: { where: { id: string }; data: Partial<AsyncJobRecord> }): Promise<AsyncJobRecord>;
    updateMany(args: {
      where: JobClaimWhere;
      data: Partial<AsyncJobRecord>;
    }): Promise<{ count: number }>;
  };
}

export type JobFailureDisposition = "RETRY" | "TERMINAL";

export class JobProcessingError extends Error {
  constructor(
    public readonly code: "FILE_CORRUPT" | "MODEL_SCHEMA_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "JobProcessingError";
  }
}

export class JobService {
  constructor(
    private readonly database: JobDatabase = prisma as unknown as JobDatabase,
    private readonly queue: JobQueue = new BullMqJobQueue(),
    private readonly options: { now?: () => Date; retryDelayMs?: number } = {},
  ) {}

  async enqueue(
    type: AsyncJobType,
    dedupeKey: string,
    payload: unknown,
    requestedByUserId: string | null = null,
  ): Promise<AsyncJobRecord> {
    const availableAt = this.now();
    const job = await this.database.asyncJob.upsert({
      where: { dedupeKey },
      create: {
        requestedByUserId,
        type,
        dedupeKey,
        status: "PENDING",
        attempt: 0,
        maxAttempts: 3,
        retryAt: null,
        availableAt,
        payload,
      },
      update: {},
    });

    await this.queue.enqueue(job.id, { delayMs: Math.max(0, job.availableAt.getTime() - this.now().getTime()) });
    return job;
  }

  async enqueuePersisted(jobId: string, availableAt: Date): Promise<void> {
    await this.queue.enqueue(jobId, { delayMs: Math.max(0, availableAt.getTime() - this.now().getTime()) });
  }

  async start(jobId: string): Promise<AsyncJobRecord | null> {
    const claimedAt = this.now();
    let job = await this.requireJob(jobId);

    if (job.status === "RETRY_WAIT") {
      const madePending = await this.database.asyncJob.updateMany({
        where: { id: job.id, status: "RETRY_WAIT", retryAt: { lte: claimedAt } },
        data: { status: "PENDING", availableAt: claimedAt, retryAt: null },
      });
      if (!madePending.count) return null;
      job = await this.requireJob(jobId);
    }

    if (job.status !== "PENDING") return null;
    const claimed = await this.database.asyncJob.updateMany({
      where: { id: job.id, status: "PENDING", availableAt: { lte: claimedAt } },
      data: {
        status: "RUNNING",
        attempt: job.attempt + 1,
        startedAt: claimedAt,
        retryAt: null,
      },
    });
    if (!claimed.count) return null;

    return this.requireJob(jobId);
  }

  async succeed(jobId: string, result: unknown): Promise<void> {
    const job = await this.requireJob(jobId);
    this.requireRunning(job);
    await this.database.asyncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", result, finishedAt: this.now() },
    });
  }

  async fail(jobId: string, error: unknown): Promise<JobFailureDisposition> {
    const job = await this.requireJob(jobId);
    this.requireRunning(job);
    const failure = this.failureDetails(error);

    if (error instanceof JobProcessingError) {
      await this.database.asyncJob.update({
        where: { id: job.id },
        data: { status: "FAILED", ...failure, finishedAt: this.now() },
      });
      return "TERMINAL";
    }

    if (job.attempt >= job.maxAttempts) {
      await this.database.asyncJob.update({
        where: { id: job.id },
        data: { status: "DEAD_LETTER", ...failure, finishedAt: this.now() },
      });
      return "TERMINAL";
    }

    const retryAt = new Date(this.now().getTime() + this.retryDelayMs());
    await this.database.asyncJob.update({
      where: { id: job.id },
      data: { status: "RETRY_WAIT", ...failure, retryAt },
    });
    return "RETRY";
  }

  async reconcile(): Promise<void> {
    const reconciledAt = this.now();
    const pendingJobs = await this.database.asyncJob.findMany({
      where: { status: { in: ["PENDING", "RETRY_WAIT"] } },
    });

    for (const job of pendingJobs) {
      if (!await this.queue.has(job.id)) {
        const availableAt = job.status === "RETRY_WAIT" ? job.retryAt : job.availableAt;
        if (!availableAt) continue;
        await this.queue.enqueue(job.id, { delayMs: Math.max(0, availableAt.getTime() - reconciledAt.getTime()) });
      }
    }
  }

  async getForUser(userId: string, jobId: string): Promise<AsyncJobRecord> {
    const job = await this.requireJob(jobId);
    if (job.requestedByUserId !== userId) {
      throw new AppError("NOT_FOUND", 404, "Job not found");
    }
    return job;
  }

  private async requireJob(jobId: string): Promise<AsyncJobRecord> {
    const job = await this.database.asyncJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND", 404, "Job not found");
    return job;
  }

  private requireRunning(job: AsyncJobRecord): void {
    if (job.status !== "RUNNING") {
      throw new AppError("RESOURCE_CONFLICT", 409, "Job is not running");
    }
  }

  private failureDetails(error: unknown): Pick<AsyncJobRecord, "errorCode" | "errorDetail"> {
    if (error instanceof JobProcessingError) {
      return { errorCode: error.code, errorDetail: error.message };
    }
    return {
      errorCode: "TRANSIENT_ERROR",
      errorDetail: error instanceof Error ? error.message : "Unknown processing failure",
    };
  }

  private now(): Date {
    return (this.options.now ?? (() => new Date()))();
  }

  private retryDelayMs(): number {
    return this.options.retryDelayMs ?? 1_000;
  }
}

export type { JobQueue } from "./queue";

import { Worker as BullMqWorker } from "bullmq";
import {
  ASYNC_JOB_QUEUE_NAME,
  createRedisConnection,
  JobService,
  type AsyncJobRecord,
} from "@lightning-tiger/server";

export interface JobProcessor {
  process(job: Pick<AsyncJobRecord, "id" | "type" | "payload">): Promise<unknown>;
}

type JobWorkerService = Pick<JobService, "start" | "succeed" | "fail" | "reconcile">;

export interface QueueWorker {
  on(event: "ready", listener: () => void): unknown;
}

export interface QueueWorkerFactory {
  create(handler: (payload: { jobId: string }) => Promise<void>): QueueWorker;
}

const bullMqWorkerFactory: QueueWorkerFactory = {
  create(handler) {
    return new BullMqWorker<{ jobId: string }>(
      ASYNC_JOB_QUEUE_NAME,
      (job) => handler(job.data),
      { connection: createRedisConnection() },
    );
  },
};

export class JobWorker {
  constructor(
    private readonly jobs: JobWorkerService,
    private readonly processor: JobProcessor,
  ) {}

  async process(jobId: string): Promise<void> {
    const job = await this.jobs.start(jobId);
    if (!job) return;

    try {
      const result = await this.processor.process(job);
      await this.jobs.succeed(job.id, result);
    } catch (error) {
      await this.jobs.fail(job.id, error);
    }
  }

  async reconcile(): Promise<void> {
    await this.jobs.reconcile();
  }
}

export function startJobWorker(
  processor: JobProcessor,
  jobs: JobWorkerService = new JobService(),
  factory: QueueWorkerFactory = bullMqWorkerFactory,
): QueueWorker {
  const runner = new JobWorker(jobs, processor);
  const worker = factory.create((payload) => runner.process(payload.jobId));
  worker.on("ready", () => {
    void runner.reconcile();
  });
  return worker;
}

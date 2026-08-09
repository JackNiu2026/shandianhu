import { Queue } from "bullmq";
import IORedis from "ioredis";

export const ASYNC_JOB_QUEUE_NAME = "async-jobs";

export interface JobQueue {
  enqueue(jobId: string, options: { delayMs: number }): Promise<void>;
  has(jobId: string): Promise<boolean>;
}

export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for async jobs");

  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export class BullMqJobQueue implements JobQueue {
  private queue: Queue<{ jobId: string }> | undefined;

  constructor(private readonly createConnection: () => IORedis = createRedisConnection) {}

  async enqueue(jobId: string, options: { delayMs: number }): Promise<void> {
    await this.getQueue().add("async-job", { jobId }, {
      jobId,
      delay: options.delayMs,
    });
  }

  async has(jobId: string): Promise<boolean> {
    return Boolean(await this.getQueue().getJob(jobId));
  }

  private getQueue(): Queue<{ jobId: string }> {
    this.queue ??= new Queue(ASYNC_JOB_QUEUE_NAME, { connection: this.createConnection() });
    return this.queue;
  }
}

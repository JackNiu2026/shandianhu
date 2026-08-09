import { describe, expect, it, vi } from "vitest";
import { JobWorker, startJobWorker, type JobProcessor, type QueueWorkerFactory } from "./worker";

describe("JobWorker", () => {
  it("runs a database job and records successful completion", async () => {
    const jobs = {
      start: vi.fn().mockResolvedValue({ id: "job-1", type: "ASSESSMENT_PROCESSING", payload: { runId: "1" } }),
      succeed: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn().mockResolvedValue(undefined),
    };
    const processor: JobProcessor = { process: vi.fn().mockResolvedValue({ reportId: "report-1" }) };
    const worker = new JobWorker(jobs, processor);

    await worker.process("job-1");

    expect(processor.process).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }));
    expect(jobs.succeed).toHaveBeenCalledWith("job-1", { reportId: "report-1" });
  });

  it("records processing failures and runs reconciliation", async () => {
    const error = new Error("model unavailable");
    const jobs = {
      start: vi.fn().mockResolvedValue({ id: "job-1", type: "ASSESSMENT_PROCESSING", payload: {} }),
      succeed: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue("RETRY"),
      reconcile: vi.fn().mockResolvedValue(undefined),
    };
    const processor: JobProcessor = { process: vi.fn().mockRejectedValue(error) };
    const worker = new JobWorker(jobs, processor);

    await expect(worker.process("job-1")).rejects.toThrow(error);
    await worker.reconcile();

    expect(jobs.fail).toHaveBeenCalledWith("job-1", error);
    expect(jobs.reconcile).toHaveBeenCalledOnce();
  });

  it("connects queue delivery to processing and reconciles when ready", async () => {
    const jobs = {
      start: vi.fn().mockResolvedValue({ id: "job-1", type: "ASSESSMENT_PROCESSING", payload: {} }),
      succeed: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn().mockResolvedValue(undefined),
    };
    const processor: JobProcessor = { process: vi.fn().mockResolvedValue(undefined) };
    let deliver: ((payload: { jobId: string }) => Promise<void>) | undefined;
    const queueWorker = { on: vi.fn((_event: "ready", listener: () => void) => listener()) };
    const factory: QueueWorkerFactory = {
      create: vi.fn((handler) => {
        deliver = handler;
        return queueWorker;
      }),
    };

    startJobWorker(processor, jobs, factory);
    await deliver?.({ jobId: "job-1" });

    expect(factory.create).toHaveBeenCalledOnce();
    expect(processor.process).toHaveBeenCalledOnce();
    expect(jobs.reconcile).toHaveBeenCalledOnce();
  });
});

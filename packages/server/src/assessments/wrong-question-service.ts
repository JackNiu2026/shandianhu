import { AppError } from "../errors/app-error";
export class WrongQuestionService {
  constructor(private readonly database: any, private readonly children: { listChildren(userId: string): Promise<Array<{ id: string }>> }, private readonly jobs: any) {}
  async submit(userId: string, input: { childId: string; fileIds: string[]; idempotencyKey: string }) {
    if (input.fileIds.length < 1 || input.fileIds.length > 9) throw new AppError("VALIDATION_ERROR", 400, "Submit one to nine images");
    if (!(await this.children.listChildren(userId)).some((child) => child.id === input.childId)) throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    const run = await this.database.assessmentRun.upsert({ where: { childId_idempotencyKey: { childId: input.childId, idempotencyKey: input.idempotencyKey } }, create: { childId: input.childId, idempotencyKey: input.idempotencyKey, requestedByUserId: userId, status: "CREATED" }, update: {} });
    const job = await this.jobs.enqueue("ASSESSMENT_PROCESSING", `wrong-questions:${run.id}`, { runId: run.id, fileIds: input.fileIds }, userId);
    return { runId: run.id, taskId: job.id };
  }
}

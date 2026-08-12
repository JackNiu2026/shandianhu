import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { JobService, type JobDatabase } from "../jobs/job-service";

type OwnedChild = { id: string; parentProfileId: string; deletedAt: Date | null };
type ParentProfile = { id: string; userId: string };
type FileObject = { id: string; ownerUserId: string; parentProfileId: string | null; childId: string | null; status: "ACTIVE" | "DELETED" | "REVOKED"; deletedAt: Date | null; revokedAt: Date | null };
type AssessmentRun = { id: string };
type AssessmentVersion = { id: string };

export interface WrongQuestionTransaction extends JobDatabase {
  parentProfile: { findUnique(args: { where: { userId: string } }): Promise<ParentProfile | null> };
  child: { findUnique(args: { where: { id: string } }): Promise<OwnedChild | null> };
  fileObject: { findMany(args: { where: { id: { in: string[] }; ownerUserId: string; parentProfileId: string; childId: string; status: "ACTIVE"; deletedAt: null; revokedAt: null } }): Promise<FileObject[]> };
  assessmentVersion: { findFirst(args: { where: { status: "PUBLISHED"; definition: { slug: string } }; orderBy: Array<{ version: "asc" | "desc" } | { id: "asc" | "desc" }> }): Promise<AssessmentVersion | null> };
  assessmentRun: {
    findUnique(args: { where: { childId_idempotencyKey: { childId: string; idempotencyKey: string } } }): Promise<AssessmentRun | null>;
    create(args: { data: { assessmentVersionId: string; childId: string; idempotencyKey: string; requestedByUserId: string; status: "CREATED" } }): Promise<AssessmentRun>;
  };
  assessmentArtifact: { create(args: { data: { childId: string; assessmentRunId: string; fileObjectId: string; ordinal: number; kind: "SOURCE_IMAGE" } }): Promise<unknown> };
}

export interface WrongQuestionDatabase {
  $transaction<T>(operation: (transaction: WrongQuestionTransaction) => Promise<T>): Promise<T>;
}

export interface PersistedJobQueue {
  enqueuePersisted(jobId: string, availableAt: Date): Promise<void>;
}

class JobServiceQueue implements PersistedJobQueue {
  constructor(private readonly jobs: JobService) {}

  async enqueuePersisted(jobId: string, availableAt: Date): Promise<void> {
    await this.jobs.enqueuePersisted(jobId, availableAt);
  }
}

export type WrongQuestionSubmission = { childId: string; fileIds: string[]; idempotencyKey: string };
export type WrongQuestionSubmissionResult = { runId: string; taskId: string };

export class WrongQuestionService {
  constructor(
    private readonly database: WrongQuestionDatabase = prisma as unknown as WrongQuestionDatabase,
    private readonly jobs: PersistedJobQueue = new JobServiceQueue(new JobService()),
  ) {}

  async submit(userId: string, input: WrongQuestionSubmission): Promise<WrongQuestionSubmissionResult> {
    if (input.fileIds.length < 1 || input.fileIds.length > 9) {
      throw new AppError("VALIDATION_ERROR", 400, "Submit one to nine images");
    }
    if (new Set(input.fileIds).size !== input.fileIds.length) {
      throw new AppError("VALIDATION_ERROR", 400, "Images must be unique");
    }

    const persisted = await this.database.$transaction(async (tx) => {
      const parent = await tx.parentProfile.findUnique({ where: { userId } });
      if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
      const child = await tx.child.findUnique({ where: { id: input.childId } });
      if (!child || child.deletedAt) throw new AppError("NOT_FOUND", 404, "Child not found");
      if (child.parentProfileId !== parent.id) throw new AppError("FORBIDDEN", 403, "You cannot access this child");

      const files = await tx.fileObject.findMany({
        where: { id: { in: input.fileIds }, ownerUserId: userId, parentProfileId: parent.id, childId: child.id, status: "ACTIVE", deletedAt: null, revokedAt: null },
      });
      if (files.length !== input.fileIds.length) throw new AppError("NOT_FOUND", 404, "One or more images are unavailable");

      let run = await tx.assessmentRun.findUnique({ where: { childId_idempotencyKey: { childId: child.id, idempotencyKey: input.idempotencyKey } } });
      if (!run) {
        const version = await tx.assessmentVersion.findFirst({
          where: { status: "PUBLISHED", definition: { slug: "wrong-question" } },
          orderBy: [{ version: "desc" }, { id: "asc" }],
        });
        if (!version) throw new AppError("NOT_FOUND", 404, "Wrong-question assessment is not available");
        run = await tx.assessmentRun.create({ data: { assessmentVersionId: version.id, childId: child.id, idempotencyKey: input.idempotencyKey, requestedByUserId: userId, status: "CREATED" } });
        for (const [index, fileId] of input.fileIds.entries()) {
          await tx.assessmentArtifact.create({ data: { childId: child.id, assessmentRunId: run.id, fileObjectId: fileId, ordinal: index + 1, kind: "SOURCE_IMAGE" } });
        }
      }

      const job = await tx.asyncJob.upsert({
        where: { dedupeKey: `wrong-questions:${run.id}` },
        create: { requestedByUserId: userId, childId: child.id, assessmentRunId: run.id, type: "ASSESSMENT_PROCESSING", dedupeKey: `wrong-questions:${run.id}`, status: "PENDING", attempt: 0, maxAttempts: 3, retryAt: null, availableAt: new Date(), payload: { runId: run.id } },
        update: {},
      });
      return { runId: run.id, taskId: job.id, availableAt: job.availableAt };
    });
    await this.jobs.enqueuePersisted(persisted.taskId, persisted.availableAt);
    return { runId: persisted.runId, taskId: persisted.taskId };
  }
}

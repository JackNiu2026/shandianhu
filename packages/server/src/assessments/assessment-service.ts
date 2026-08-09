import type { LearningStyleSubmission } from "@lightning-tiger/shared";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { JobService } from "../jobs/job-service";
import { scoreLearningStyle, type LearningStyleResult } from "./learning-style";

type AssessmentRun = { id: string };
type AssessmentResult = { id: string };

export interface LearningStyleAssessmentDatabase {
  assessmentVersion: {
    findFirst(args: { where: { version: number; status: "PUBLISHED"; definition: { slug: string } } }): Promise<{ id: string } | null>;
  };
  assessmentRun: {
    upsert(args: {
      where: { childId_idempotencyKey: { childId: string; idempotencyKey: string } };
      create: { assessmentVersionId: string; childId: string; idempotencyKey: string; requestedByUserId: string; status: "SUCCEEDED" };
      update: Record<string, never>;
    }): Promise<AssessmentRun>;
  };
  assessmentResult: {
    upsert(args: {
      where: { assessmentRunId: string };
      create: { assessmentRunId: string; result: LearningStyleResult };
      update: Record<string, never>;
    }): Promise<AssessmentResult>;
  };
  learningEvidence: {
    upsert(args: {
      where: { childId_source_sourceId: { childId: string; source: "ASSESSMENT"; sourceId: string } };
      create: { childId: string; assessmentRunId: string; source: "ASSESSMENT"; sourceId: string; payload: LearningStyleResult };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
}

type ChildAccess = { listChildren(userId: string): Promise<Array<{ id: string }>> };
type ProfileJobs = Pick<JobService, "enqueue">;

export type LearningStyleSubmissionResult = {
  runId: string;
  resultId: string;
  taskId: string;
  code: LearningStyleResult["code"];
};

export class LearningStyleAssessmentService {
  constructor(
    private readonly database: LearningStyleAssessmentDatabase = prisma as unknown as LearningStyleAssessmentDatabase,
    private readonly children: ChildAccess,
    private readonly jobs: ProfileJobs = new JobService(),
  ) {}

  async submit(userId: string, submission: LearningStyleSubmission): Promise<LearningStyleSubmissionResult> {
    const children = await this.children.listChildren(userId);
    if (!children.some((child) => child.id === submission.childId)) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    }

    const result = scoreLearningStyle(submission.answers);
    const version = await this.database.assessmentVersion.findFirst({
      where: { version: 1, status: "PUBLISHED", definition: { slug: "learning-style" } },
    });
    if (!version) throw new AppError("NOT_FOUND", 404, "Learning style assessment is not available");

    const run = await this.database.assessmentRun.upsert({
      where: { childId_idempotencyKey: { childId: submission.childId, idempotencyKey: submission.idempotencyKey } },
      create: {
        assessmentVersionId: version.id,
        childId: submission.childId,
        idempotencyKey: submission.idempotencyKey,
        requestedByUserId: userId,
        status: "SUCCEEDED",
      },
      update: {},
    });
    const storedResult = await this.database.assessmentResult.upsert({
      where: { assessmentRunId: run.id },
      create: { assessmentRunId: run.id, result },
      update: {},
    });
    await this.database.learningEvidence.upsert({
      where: { childId_source_sourceId: { childId: submission.childId, source: "ASSESSMENT", sourceId: run.id } },
      create: {
        childId: submission.childId,
        assessmentRunId: run.id,
        source: "ASSESSMENT",
        sourceId: run.id,
        payload: result,
      },
      update: {},
    });
    const job = await this.jobs.enqueue(
      "PROFILE_GENERATION",
      `learning-style:${run.id}:profile`,
      { childId: submission.childId, assessmentRunId: run.id },
      userId,
    );
    return { runId: run.id, resultId: storedResult.id, taskId: job.id, code: result.code };
  }
}

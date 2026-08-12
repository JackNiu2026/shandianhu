import {
  JobProcessingError,
  wrongQuestionResultSchema,
  type FileSigner,
  type ModelMessage,
  type WrongQuestionResult,
} from "@lightning-tiger/server";

type AssessmentRunRecord = {
  id: string;
  childId: string;
  requestedByUserId: string | null;
  artifacts: Array<{ ordinal: number; fileObject: { objectKey: string } }>;
};

type AssessmentTransaction = {
  assessmentResult: {
    upsert(args: {
      where: { assessmentRunId: string };
      create: { assessmentRunId: string; modelUsageLedgerId: string; parentNarrative: string; result: unknown };
      update: { modelUsageLedgerId: string; parentNarrative: string; result: unknown };
    }): Promise<{ id: string }>;
  };
  learningEvidence: {
    upsert(args: {
      where: { childId_source_sourceId: { childId: string; source: "ASSESSMENT"; sourceId: string } };
      create: { childId: string; assessmentRunId: string; source: "ASSESSMENT"; sourceId: string; payload: unknown };
      update: { payload: unknown; revokedAt: null };
    }): Promise<unknown>;
  };
  assessmentRun: {
    update(args: { where: { id: string }; data: { status: "SUCCEEDED"; finishedAt: Date } }): Promise<unknown>;
  };
};

export interface AssessmentAnalyzerDatabase {
  assessmentRun: {
    findUnique(args: { where: { id: string }; include: unknown }): Promise<AssessmentRunRecord | null>;
    update(args: { where: { id: string }; data: { status: "FAILED"; finishedAt: Date } }): Promise<unknown>;
  };
  $transaction<T>(operation: (transaction: AssessmentTransaction) => Promise<T>): Promise<T>;
}

export interface VisionGateway {
  complete<T>(input: {
    purpose: "ASSESSMENT";
    userId: string | undefined;
    childId: string;
    imageCount: number;
    messages: ModelMessage[];
    schema: typeof wrongQuestionResultSchema;
  }): Promise<{ callId: string; output: T }>;
}

const SIGNED_IMAGE_URL_TTL_SECONDS = 5 * 60;

export class AssessmentAnalyzer {
  constructor(
    private readonly database: AssessmentAnalyzerDatabase,
    private readonly signer: Pick<FileSigner, "signGet">,
    private readonly gateway: VisionGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run({ runId }: { runId: string }): Promise<{ runId: string; resultId: string }> {
    try {
      const run = await this.database.assessmentRun.findUnique({
        where: { id: runId },
        include: { artifacts: { orderBy: { ordinal: "asc" }, include: { fileObject: true } } },
      });
      if (!run || run.artifacts.length === 0) {
        throw new JobProcessingError("FILE_CORRUPT", "Assessment images are unavailable");
      }

      const imageUrls = await Promise.all(run.artifacts
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((artifact) => this.signer.signGet({
          objectKey: artifact.fileObject.objectKey,
          expiresInSeconds: SIGNED_IMAGE_URL_TTL_SECONDS,
        })));
      const completion = await this.gateway.complete<WrongQuestionResult>({
        purpose: "ASSESSMENT",
        userId: run.requestedByUserId ?? undefined,
        childId: run.childId,
        imageCount: imageUrls.length,
        schema: wrongQuestionResultSchema,
        messages: visionMessages(imageUrls),
      });

      return this.database.$transaction(async (transaction) => {
        const result = await transaction.assessmentResult.upsert({
          where: { assessmentRunId: run.id },
          create: {
            assessmentRunId: run.id,
            modelUsageLedgerId: completion.callId,
            parentNarrative: completion.output.summary,
            result: completion.output,
          },
          update: {
            modelUsageLedgerId: completion.callId,
            parentNarrative: completion.output.summary,
            result: completion.output,
          },
        });
        await transaction.learningEvidence.upsert({
          where: { childId_source_sourceId: { childId: run.childId, source: "ASSESSMENT", sourceId: run.id } },
          create: {
            childId: run.childId,
            assessmentRunId: run.id,
            source: "ASSESSMENT",
            sourceId: run.id,
            payload: completion.output,
          },
          update: { payload: completion.output, revokedAt: null },
        });
        await transaction.assessmentRun.update({
          where: { id: run.id },
          data: { status: "SUCCEEDED", finishedAt: this.now() },
        });
        return { runId: run.id, resultId: result.id };
      });
    } catch (error) {
      await this.database.assessmentRun.update({
        where: { id: runId },
        data: { status: "FAILED", finishedAt: this.now() },
      });
      if (error instanceof JobProcessingError) throw error;
      throw new JobProcessingError(
        "MODEL_SCHEMA_INVALID",
        error instanceof Error ? error.message : "Wrong-question analysis failed",
      );
    }
  }
}

function visionMessages(imageUrls: string[]): ModelMessage[] {
  return [
    {
      role: "system",
      content: "Analyze the submitted K12 wrong-question images. Return only the requested JSON structure.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Identify each question, error pattern, mastery estimate, and learning suggestion." },
        ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ];
}

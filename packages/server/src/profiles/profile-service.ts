import { buildConfidenceBasis, type ConfidenceEvidence } from "./confidence";

const PROFILE_RULE_VERSION = "profile-confidence-v1";

export type ProfileEvidence = ConfidenceEvidence & {
  id: string;
};

type LearningProfile = {
  id: string;
};

export type LearningProfileVersion = {
  id: string;
  learningProfileId: string;
  version: number;
  ruleVersion: string;
  snapshot: Record<string, unknown>;
  confidenceBasis: Record<string, unknown>;
};

export type ProfileTransaction = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  learningEvidence: {
    findMany(args: {
      where: { childId: string; revokedAt: null };
      orderBy: { observedAt: "asc" };
    }): Promise<ProfileEvidence[]>;
  };
  learningProfile: {
    upsert(args: {
      where: { childId: string };
      create: { childId: string };
      update: Record<string, never>;
    }): Promise<LearningProfile>;
    update(args: {
      where: { id: string };
      data: { currentVersionId: string };
    }): Promise<unknown>;
  };
  learningProfileVersion: {
    count(args: { where: { learningProfileId: string } }): Promise<number>;
    create(args: {
      data: Omit<LearningProfileVersion, "id">;
    }): Promise<LearningProfileVersion>;
  };
};

export type ProfileDatabase = {
  $transaction<T>(callback: (transaction: ProfileTransaction) => Promise<T>): Promise<T>;
};

export class ProfileService {
  constructor(
    private readonly database: ProfileDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async rebuild(childId: string): Promise<LearningProfileVersion> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        `profile:${childId}`,
      );

      const evidence = await transaction.learningEvidence.findMany({
        where: { childId, revokedAt: null },
        orderBy: { observedAt: "asc" },
      });
      const profile = await transaction.learningProfile.upsert({
        where: { childId },
        create: { childId },
        update: {},
      });
      const now = this.clock();
      const confidenceBasis = buildConfidenceBasis(evidence, now);
      const latestObservedAt = evidence.at(-1)?.observedAt.toISOString() ?? null;
      const snapshot = {
        evidenceIds: evidence.map((item) => item.id),
        evidenceCount: evidence.length,
        latestObservedAt,
        confidence: confidenceBasis.score,
      };
      const previousVersionCount = await transaction.learningProfileVersion.count({
        where: { learningProfileId: profile.id },
      });
      const version = await transaction.learningProfileVersion.create({
        data: {
          learningProfileId: profile.id,
          version: previousVersionCount + 1,
          ruleVersion: PROFILE_RULE_VERSION,
          snapshot,
          confidenceBasis: {
            ...confidenceBasis,
            calculatedAt: now.toISOString(),
          },
        },
      });
      await transaction.learningProfile.update({
        where: { id: profile.id },
        data: { currentVersionId: version.id },
      });

      return version;
    });
  }
}

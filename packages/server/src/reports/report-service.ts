import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";

type ProfileRecord = {
  id: string;
  childId: string;
  currentVersionId: string | null;
};

type ProfileVersionRecord = {
  id: string;
  learningProfileId: string;
  version?: number;
  revokedAt: Date | null;
  snapshot?: unknown;
  confidenceBasis?: unknown;
};

export type ReportBody = {
  profileVersion: number | null;
  evidenceIds: string[];
  evidenceCount: number;
  confidence: number | null;
  latestObservedAt: string | null;
};

export type LearningReportRecord = {
  id: string;
  childId: string;
  learningProfileId: string;
  learningProfileVersionId: string;
  sequence: number;
  status: "DRAFT" | "READY" | "ARCHIVED";
  narrativeVersion: string;
  body: ReportBody;
};

export type OwnedLearningReport = LearningReportRecord & {
  fileObjectId: string | null;
  child: { parentProfile: { userId: string } };
};

export interface ReportDatabase {
  learningProfile: {
    findUnique(args: { where: { id: string } }): Promise<ProfileRecord | null>;
  };
  learningProfileVersion: {
    findUnique(args: { where: { id: string } }): Promise<ProfileVersionRecord | null>;
  };
  learningReport: {
    count(args: { where: { childId: string } }): Promise<number>;
    create(args: { data: Omit<LearningReportRecord, "id"> }): Promise<LearningReportRecord>;
    findFirst?(args: { where: { learningProfileVersionId: string } }): Promise<LearningReportRecord | null>;
    findUnique?(args: { where: { id: string }; include?: unknown }): Promise<OwnedLearningReport | null>;
  };
}

export class ReportService {
  constructor(private readonly database: ReportDatabase = prisma as unknown as ReportDatabase) {}

  /**
   * 幂等查找或创建基于画像版本的报告。
   * 同一 learningProfileVersionId 不会重复创建报告，保证 rebuild 重试时不产生重复报告。
   */
  async findOrCreateForProfile(profileId: string, versionId: string): Promise<LearningReportRecord> {
    const findFirst = this.database.learningReport.findFirst;
    if (findFirst) {
      const existing = await findFirst({ where: { learningProfileVersionId: versionId } });
      if (existing) return existing;
    }
    return this.createForProfile(profileId);
  }

  async createForProfile(profileId: string): Promise<LearningReportRecord> {
    const profile = await this.database.learningProfile.findUnique({ where: { id: profileId } });
    if (!profile?.currentVersionId) throw new AppError("NOT_FOUND", 404, "No active learning profile found");

    const profileVersion = await this.database.learningProfileVersion.findUnique({
      where: { id: profile.currentVersionId },
    });
    if (
      !profileVersion
      || profileVersion.learningProfileId !== profile.id
      || profileVersion.revokedAt
    ) {
      throw new AppError("NOT_FOUND", 404, "No active learning profile found");
    }

    const sequence = await this.database.learningReport.count({ where: { childId: profile.childId } }) + 1;
    return this.database.learningReport.create({
      data: {
        childId: profile.childId,
        learningProfileId: profile.id,
        learningProfileVersionId: profileVersion.id,
        sequence,
        status: "DRAFT",
        narrativeVersion: "facts-v1",
        body: toReportBody(profileVersion),
      },
    });
  }

  async getForUser(userId: string, reportId: string): Promise<OwnedLearningReport> {
    const findUnique = this.database.learningReport.findUnique;
    if (!findUnique) throw new AppError("INTERNAL_ERROR", 500, "Report store does not support reads");
    const report = await findUnique({
      where: { id: reportId },
      include: { child: { include: { parentProfile: true } } },
    });
    if (!report || report.child.parentProfile.userId !== userId) {
      throw new AppError("NOT_FOUND", 404, "Report not found");
    }
    return report;
  }
}

function toReportBody(profileVersion: ProfileVersionRecord): ReportBody {
  const snapshot = asRecord(profileVersion.snapshot);
  const confidenceBasis = asRecord(profileVersion.confidenceBasis);
  const evidenceIds = stringArray(snapshot.evidenceIds);
  const evidenceCount = nonNegativeInteger(snapshot.evidenceCount) ?? evidenceIds.length;
  return {
    profileVersion: nonNegativeInteger(profileVersion.version),
    evidenceIds,
    evidenceCount,
    confidence: finiteNumber(snapshot.confidence) ?? finiteNumber(confidenceBasis.score),
    latestObservedAt: typeof snapshot.latestObservedAt === "string" ? snapshot.latestObservedAt : null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ParentProfile = { id: string; userId: string; activeChildId: string | null };
type Child = { id: string; parentProfileId: string; deletedAt: Date | null; purgeAfter: Date | null };
type FileObject = {
  id: string;
  ownerUserId: string;
  parentProfileId: string | null;
  childId: string | null;
  status: "ACTIVE" | "DELETED" | "REVOKED";
  deletedAt: Date | null;
  revokedAt: Date | null;
};

type PrivacyTransaction = {
  parentProfile: {
    findUnique(args: { where: { userId: string } }): Promise<ParentProfile | null>;
    update?(args: { where: { id: string }; data: { activeChildId: string | null } }): Promise<unknown>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<Child | null>;
    update(args: { where: { id: string }; data: { deletedAt: Date | null; purgeAfter: Date | null } }): Promise<unknown>;
  };
  fileObject: {
    findUnique(args: { where: { id: string } }): Promise<FileObject | null>;
    update(args: { where: { id: string }; data: { status: "DELETED"; deletedAt: Date; revokedAt: Date } }): Promise<unknown>;
  };
  assessmentArtifact: {
    findMany(args: { where: { fileObjectId: string }; select: { assessmentRunId: true } }): Promise<Array<{ assessmentRunId: string }>>;
  };
  learningEvidence: {
    updateMany(args: { where: { childId: string; assessmentRunId: { in: string[] }; revokedAt: null }; data: { revokedAt: Date } }): Promise<unknown>;
  };
  learningReport: {
    findMany(args: { where: { childId: string }; select: { id: true } }): Promise<Array<{ id: string }>>;
  };
  reportShare: {
    updateMany(args: { where: { learningReportId: { in: string[] }; revokedAt: null }; data: { revokedAt: Date } }): Promise<unknown>;
  };
};

export interface PrivacyDatabase {
  $transaction<T>(callback: (transaction: PrivacyTransaction) => Promise<T>): Promise<T>;
}

export interface PrivacyJobQueue {
  enqueue(type: "PROFILE_GENERATION", dedupeKey: string, payload: { childId: string }, userId: string): Promise<unknown>;
}

export class PrivacyDeletionService {
  constructor(
    private readonly database: PrivacyDatabase = prisma as unknown as PrivacyDatabase,
    private readonly jobs: PrivacyJobQueue,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async deleteAssessmentSource(userId: string, fileId: string): Promise<void> {
    const deleted = await this.database.$transaction(async (transaction) => {
      const parent = await this.requireParent(transaction, userId);
      const file = await transaction.fileObject.findUnique({ where: { id: fileId } });
      if (!file || file.ownerUserId !== userId || file.parentProfileId !== parent.id || !file.childId) {
        throw new AppError("NOT_FOUND", 404, "Assessment source not found");
      }
      const child = await this.requireOwnedChild(transaction, parent.id, file.childId);
      if (file.status !== "ACTIVE" || file.deletedAt || file.revokedAt) {
        throw new AppError("NOT_FOUND", 404, "Assessment source not found");
      }

      const now = this.clock();
      await transaction.fileObject.update({
        where: { id: file.id },
        data: { status: "DELETED", deletedAt: now, revokedAt: now },
      });
      const artifacts = await transaction.assessmentArtifact.findMany({
        where: { fileObjectId: file.id },
        select: { assessmentRunId: true },
      });
      const runIds = [...new Set(artifacts.map((artifact) => artifact.assessmentRunId))];
      if (runIds.length) {
        await transaction.learningEvidence.updateMany({
          where: { childId: child.id, assessmentRunId: { in: runIds }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      const reports = await transaction.learningReport.findMany({
        where: { childId: child.id },
        select: { id: true },
      });
      const reportIds = reports.map((report) => report.id);
      if (reportIds.length) {
        await transaction.reportShare.updateMany({
          where: { learningReportId: { in: reportIds }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      return { childId: child.id };
    });

    await this.jobs.enqueue("PROFILE_GENERATION", `privacy:${fileId}:profile`, { childId: deleted.childId }, userId);
  }

  async softDeleteChild(userId: string, childId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const parent = await this.requireParent(transaction, userId);
      const child = await this.requireOwnedChild(transaction, parent.id, childId);
      const now = this.clock();
      await transaction.child.update({
        where: { id: child.id },
        data: { deletedAt: now, purgeAfter: new Date(now.getTime() + RECOVERY_WINDOW_MS) },
      });
      if (parent.activeChildId === child.id) {
        await transaction.parentProfile.update?.({ where: { id: parent.id }, data: { activeChildId: null } });
      }
    });
  }

  async restoreChild(userId: string, childId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const parent = await this.requireParent(transaction, userId);
      const child = await transaction.child.findUnique({ where: { id: childId } });
      if (!child || child.parentProfileId !== parent.id || !child.deletedAt || !child.purgeAfter) {
        throw new AppError("NOT_FOUND", 404, "Deleted child not found");
      }
      if (child.purgeAfter <= this.clock()) {
        throw new AppError("NOT_FOUND", 404, "Recovery period has ended");
      }
      await transaction.child.update({ where: { id: child.id }, data: { deletedAt: null, purgeAfter: null } });
    });
  }

  private async requireParent(transaction: PrivacyTransaction, userId: string): Promise<ParentProfile> {
    const parent = await transaction.parentProfile.findUnique({ where: { userId } });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    return parent;
  }

  private async requireOwnedChild(transaction: PrivacyTransaction, parentProfileId: string, childId: string): Promise<Child> {
    const child = await transaction.child.findUnique({ where: { id: childId } });
    if (!child || child.parentProfileId !== parentProfileId || child.deletedAt) {
      throw new AppError("NOT_FOUND", 404, "Child not found");
    }
    return child;
  }
}

export { RECOVERY_WINDOW_MS };

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const REPORT_SHARE_DOWNLOAD_TTL_SECONDS = 5 * 60;

type OwnedReport = {
  id: string;
  status: "DRAFT" | "READY" | "ARCHIVED";
  fileObjectId: string | null;
  child: { parentProfile: { userId: string } };
};

type ShareRecord = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  learningReport: Pick<OwnedReport, "id" | "status" | "fileObjectId">;
};

export interface ReportShareDatabase {
  learningReport: {
    findUnique(args: { where: { id: string }; include?: unknown }): Promise<OwnedReport | null>;
  };
  reportShare: {
    create(args: { data: { learningReportId: string; createdByUserId: string; tokenHash: string; expiresAt: Date } }): Promise<{ id: string }>;
    findUnique(args: { where: { id?: string; tokenHash?: string }; include?: unknown }): Promise<ShareRecord | null>;
    update(args: { where: { id: string }; data: { revokedAt: Date } }): Promise<unknown>;
  };
  fileObject?: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      objectKey: string;
      status: "ACTIVE" | "DELETED" | "REVOKED";
      deletedAt: Date | null;
      revokedAt: Date | null;
    } | null>;
  };
}

export type ReportDownloadSigner = {
  signGet(input: { objectKey: string; expiresInSeconds: number }): Promise<string>;
};

type ShareDependencies = {
  randomToken: () => string;
  clock: () => Date;
};

const defaultDependencies: ShareDependencies = {
  randomToken: () => randomBytes(32).toString("base64url"),
  clock: () => new Date(),
};

export class ReportShareService {
  constructor(
    private readonly database: ReportShareDatabase = prisma as unknown as ReportShareDatabase,
    private readonly dependencies: ShareDependencies = defaultDependencies,
  ) {}

  async issue(reportId: string, userId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<{ id: string; token: string; expiresAt: Date }> {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid share lifetime");
    }
    await this.requireOwnedReadyReport(reportId, userId);
    const token = this.dependencies.randomToken();
    const expiresAt = new Date(this.dependencies.clock().getTime() + ttlSeconds * 1000);
    const share = await this.database.reportShare.create({
      data: {
        learningReportId: reportId,
        createdByUserId: userId,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });
    return { id: share.id, token, expiresAt };
  }

  async revoke(shareId: string, userId: string): Promise<void> {
    const share = await this.database.reportShare.findUnique({
      where: { id: shareId },
      include: { learningReport: { include: { child: { include: { parentProfile: true } } } } },
    });
    const ownerUserId = (share?.learningReport as OwnedReport | undefined)?.child?.parentProfile?.userId;
    if (!share || ownerUserId !== userId) throw new AppError("NOT_FOUND", 404, "Share link not found");
    if (!share.revokedAt) {
      await this.database.reportShare.update({ where: { id: share.id }, data: { revokedAt: this.dependencies.clock() } });
    }
  }

  async resolve(token: string): Promise<ShareRecord> {
    const share = await this.database.reportShare.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { learningReport: true },
    });
    if (
      !share
      || share.revokedAt
      || share.expiresAt <= this.dependencies.clock()
      || share.learningReport.status !== "READY"
    ) {
      throw new AppError("NOT_FOUND", 404, "Share link not found");
    }
    return share;
  }

  async resolveDownload(token: string, signer: ReportDownloadSigner): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const share = await this.resolve(token);
    const fileId = share.learningReport.fileObjectId;
    const file = fileId && this.database.fileObject
      ? await this.database.fileObject.findUnique({ where: { id: fileId } })
      : null;
    if (!file || file.status !== "ACTIVE" || file.deletedAt || file.revokedAt) {
      throw new AppError("NOT_FOUND", 404, "Shared report file not found");
    }
    return {
      downloadUrl: await signer.signGet({
        objectKey: file.objectKey,
        expiresInSeconds: REPORT_SHARE_DOWNLOAD_TTL_SECONDS,
      }),
      expiresInSeconds: REPORT_SHARE_DOWNLOAD_TTL_SECONDS,
    };
  }

  private async requireOwnedReadyReport(reportId: string, userId: string): Promise<void> {
    const report = await this.database.learningReport.findUnique({
      where: { id: reportId },
      include: { child: { include: { parentProfile: true } } },
    });
    if (!report || report.status !== "READY" || report.child.parentProfile.userId !== userId) {
      throw new AppError("NOT_FOUND", 404, "Report not found");
    }
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS, REPORT_SHARE_DOWNLOAD_TTL_SECONDS };

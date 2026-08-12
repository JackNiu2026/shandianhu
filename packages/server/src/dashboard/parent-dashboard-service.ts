import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";

export type ParentDashboard = {
  activeChild: { id: string; displayName: string; grade: string | null } | null;
  recentReports: Array<{ id: string; sequence: number; status: string; createdAt: string }>;
  pendingJobs: Array<{ id: string; type: string; status: string; createdAt: string }>;
  recentEvidence: Array<{ id: string; source: string; observedAt: string }>;
  unreadNotifications: number;
};

const DASHBOARD_LIMIT = 5;

type ParentWithActiveChild = {
  id: string;
  userId: string;
  activeChildId: string | null;
  activeChild: { id: string; name: string; grade: string | null } | null;
};

type DashboardReportRecord = {
  id: string;
  sequence: number;
  status: string;
  createdAt: Date;
};

type DashboardJobRecord = {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
};

type DashboardEvidenceRecord = {
  id: string;
  source: string;
  observedAt: Date;
};

export interface DashboardDatabase {
  parentProfile: {
    findUnique(args: {
      where: { userId: string };
      include?: { activeChild?: boolean };
    }): Promise<ParentWithActiveChild | null>;
  };
  learningReport: {
    findMany(args: {
      where: { childId: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<DashboardReportRecord[]>;
  };
  asyncJob: {
    findMany(args: {
      where: {
        requestedByUserId: string;
        status: { in: Array<"PENDING" | "RUNNING" | "RETRY_WAIT"> };
      };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<DashboardJobRecord[]>;
  };
  learningEvidence: {
    findMany(args: {
      where: { childId: string; revokedAt: null };
      orderBy: { observedAt: "desc" };
      take: number;
    }): Promise<DashboardEvidenceRecord[]>;
  };
  notification: {
    count(args: { where: { userId: string; status: "UNREAD" } }): Promise<number>;
  };
}

export class ParentDashboardService {
  constructor(
    private readonly database: DashboardDatabase = prisma as unknown as DashboardDatabase,
  ) {}

  /** 聚合查询当前活跃儿童的概览：报告、任务、证据与未读通知数。 */
  async load(userId: string): Promise<ParentDashboard> {
    const parent = await this.database.parentProfile.findUnique({
      where: { userId },
      include: { activeChild: true },
    });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");

    const activeChild = parent.activeChild
      ? {
          id: parent.activeChild.id,
          displayName: parent.activeChild.name,
          grade: parent.activeChild.grade,
        }
      : null;

    const [recentReports, pendingJobs, recentEvidence, unreadNotifications] = await Promise.all([
      activeChild
        ? this.database.learningReport.findMany({
            where: { childId: activeChild.id },
            orderBy: { createdAt: "desc" },
            take: DASHBOARD_LIMIT,
          })
        : Promise.resolve([] as DashboardReportRecord[]),
      this.database.asyncJob.findMany({
        where: {
          requestedByUserId: userId,
          status: { in: ["PENDING", "RUNNING", "RETRY_WAIT"] },
        },
        orderBy: { createdAt: "desc" },
        take: DASHBOARD_LIMIT,
      }),
      activeChild
        ? this.database.learningEvidence.findMany({
            where: { childId: activeChild.id, revokedAt: null },
            orderBy: { observedAt: "desc" },
            take: DASHBOARD_LIMIT,
          })
        : Promise.resolve([] as DashboardEvidenceRecord[]),
      this.database.notification.count({
        where: { userId, status: "UNREAD" },
      }),
    ]);

    return {
      activeChild,
      recentReports: recentReports.map((report) => ({
        id: report.id,
        sequence: report.sequence,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      })),
      pendingJobs: pendingJobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
      })),
      recentEvidence: recentEvidence.map((evidence) => ({
        id: evidence.id,
        source: evidence.source,
        observedAt: evidence.observedAt.toISOString(),
      })),
      unreadNotifications,
    };
  }
}

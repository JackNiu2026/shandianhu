/**
 * V2.3 管理员逐项审核、补材料、通过和停用
 *
 * 管理员对老师提交的申请逐项审核资质，全部必需资质（IDENTITY + EDUCATION）
 * PASS 后可批准并创建公开 TeacherProfile。公开资料永不返回 fileObjectId 或 legalName。
 * 支持暂停（PAUSED）和封禁（BANNED），以及从暂停恢复。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import { sanitizeAuditDiff } from "../audit/audit-service";
import type { AdminContext } from "../auth/role-context";
import type {
  TeacherApplicationStatus,
  QualificationType,
  QualificationReviewStatus,
  TeachingMode,
  TeacherServiceStatus,
  Subject,
  SchoolStage,
  AuditAction,
  AuditActorKind,
  AuditEntityType,
} from "@prisma/client";

// ─── 记录类型 ───────────────────────────────────────────────

export type ApplicationRecord = {
  id: string;
  userId: string;
  status: TeacherApplicationStatus;
  legalName: string;
  education: string | null;
  experienceYears: number | null;
  pricePerHour: number | null;
  bio: string | null;
  teachingModes: TeachingMode[];
  serviceAreaCode: string | null;
  version: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QualificationRecord = {
  id: string;
  applicationId: string;
  type: QualificationType;
  fileObjectId: string;
  reviewStatus: QualificationReviewStatus;
  reviewReason: string | null;
  reviewedAt: Date | null;
  reviewedByAdminUserId: string | null;
  createdAt: Date;
};

export type AuditRecord = {
  id: string;
  applicationId: string;
  action: string;
  reason: string | null;
  actorAdminUserId: string | null;
  createdAt: Date;
};

export type ProfileRecord = {
  id: string;
  userId: string;
  applicationId: string;
  displayName: string;
  bio: string;
  subjects: Subject[];
  schoolStages: SchoolStage[];
  teachingModes: TeachingMode[];
  serviceAreaCodes: string[];
  teachingTags: string[];
  experienceYears: number;
  pricePerHour: number;
  serviceStatus: TeacherServiceStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type UserRecord = {
  id: string;
  displayName: string | null;
};

export type ApplicationAuditDetail = ApplicationRecord & {
  qualifications: QualificationRecord[];
  auditRecords: AuditRecord[];
};

// ─── 输入类型 ───────────────────────────────────────────────

export type ReviewQualificationInput = {
  status: QualificationReviewStatus;
  reason?: string;
};

// ─── 常量 ───────────────────────────────────────────────────

const REQUIRED_QUALIFICATION_TYPES: QualificationType[] = ["IDENTITY", "EDUCATION"];

// ─── 数据库接口 ─────────────────────────────────────────────

export interface TeacherAuditDatabase {
  teacherApplication: {
    findMany(args: {
      where: { status: { in: TeacherApplicationStatus[] } };
      orderBy: { updatedAt: "desc" };
    }): Promise<ApplicationRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<ApplicationRecord | null>;
    update(args: {
      where: { id: string };
      data: Partial<{
        status: TeacherApplicationStatus;
        version: number;
      }>;
    }): Promise<ApplicationRecord>;
  };
  teacherQualification: {
    findMany(args: { where: { applicationId: string } }): Promise<QualificationRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<QualificationRecord | null>;
    update(args: {
      where: { id: string };
      data: Partial<{
        reviewStatus: QualificationReviewStatus;
        reviewReason: string;
        reviewedAt: Date;
        reviewedByAdminUserId: string;
      }>;
    }): Promise<QualificationRecord>;
  };
  teacherAuditRecord: {
    findMany(args: {
      where: { applicationId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<AuditRecord[]>;
    create(args: {
      data: {
        applicationId: string;
        action: string;
        reason: string | null;
        actorAdminUserId: string | null;
      };
    }): Promise<unknown>;
  };
  teacherProfile: {
    findUnique(args: {
      where: { id: string } | { userId: string } | { applicationId: string };
    }): Promise<ProfileRecord | null>;
    create(args: {
      data: {
        userId: string;
        applicationId: string;
        displayName: string;
        bio: string;
        subjects: Subject[];
        schoolStages: SchoolStage[];
        teachingModes: TeachingMode[];
        serviceAreaCodes: string[];
        teachingTags: string[];
        experienceYears: number;
        pricePerHour: number;
        serviceStatus: TeacherServiceStatus;
        version: number;
      };
    }): Promise<ProfileRecord>;
    update(args: {
      where: { id: string };
      data: Partial<{
        serviceStatus: TeacherServiceStatus;
        version: number;
      }>;
    }): Promise<ProfileRecord>;
  };
  user: {
    findUnique(args: { where: { id: string } }): Promise<UserRecord | null>;
  };
  auditLog: {
    create(args: {
      data: {
        actorKind: AuditActorKind;
        actorAdminUserId: string;
        subjectUserId: string;
        entityType: AuditEntityType;
        entityId: string;
        action: AuditAction;
        sanitizedDiff: unknown;
      };
    }): Promise<unknown>;
  };
  notification: {
    upsert(args: {
      where: { dedupeKey: string };
      create: {
        userId: string;
        type: string;
        dedupeKey: string;
        body: Record<string, unknown>;
        targetRoute: string | null;
        targetParams: Record<string, unknown> | null;
      };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: TeacherAuditDatabase) => Promise<T>): Promise<T>;
}

// ─── 服务 ───────────────────────────────────────────────────

export class AuditService {
  constructor(
    private readonly database: TeacherAuditDatabase = prisma as unknown as TeacherAuditDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * 列出待审核的申请（SUBMITTED 或 UNDER_REVIEW）。
   */
  async listPending(_ctx: AdminContext): Promise<ApplicationRecord[]> {
    return this.database.teacherApplication.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * 获取申请详情（含资质和审核记录）。
   */
  async getDetail(applicationId: string, _ctx: AdminContext): Promise<ApplicationAuditDetail> {
    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }
    const [qualifications, auditRecords] = await Promise.all([
      this.database.teacherQualification.findMany({
        where: { applicationId },
      }),
      this.database.teacherAuditRecord.findMany({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { ...application, qualifications, auditRecords };
  }

  /**
   * 逐项审核资质。设置 PASS/FAIL、原因、审核人和时间。
   */
  async reviewQualification(
    applicationId: string,
    qualificationId: string,
    input: ReviewQualificationInput,
    ctx: AdminContext,
  ): Promise<QualificationRecord> {
    const qualification = await this.database.teacherQualification.findUnique({
      where: { id: qualificationId },
    });
    if (!qualification || qualification.applicationId !== applicationId) {
      throw new AppError("NOT_FOUND", 404, "Qualification not found");
    }

    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }

    if (input.status !== "PASS" && input.status !== "FAIL") {
      throw new AppError("VALIDATION_ERROR", 400, "Review status must be PASS or FAIL");
    }

    const now = this.clock();
    return this.database.$transaction(async (tx) => {
      const updated = await tx.teacherQualification.update({
        where: { id: qualificationId },
        data: {
          reviewStatus: input.status,
          reviewReason: input.reason ?? undefined,
          reviewedAt: now,
          reviewedByAdminUserId: ctx.adminUserId,
        },
      });

      await tx.teacherAuditRecord.create({
        data: {
          applicationId,
          action: `REVIEW_${input.status}`,
          reason: input.reason ?? null,
          actorAdminUserId: ctx.adminUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          subjectUserId: application.userId,
          entityType: "TEACHER_APPLICATION",
          entityId: applicationId,
          action: "UPDATE",
          sanitizedDiff: sanitizeAuditDiff({
            qualificationId,
            type: qualification.type,
            reviewStatus: input.status,
            reason: input.reason ?? null,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * 要求补充材料。设置 NEEDS_MORE_INFO 并发送站内通知。
   */
  async requestMoreInfo(
    applicationId: string,
    reason: string,
    ctx: AdminContext,
  ): Promise<ApplicationRecord> {
    if (!reason || reason.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Reason is required");
    }

    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }

    const now = this.clock();
    const updated = await this.database.$transaction(async (tx) => {
      const app = await tx.teacherApplication.update({
        where: { id: applicationId },
        data: {
          status: "NEEDS_MORE_INFO",
          version: application.version + 1,
        },
      });

      await tx.teacherAuditRecord.create({
        data: {
          applicationId,
          action: "REQUEST_MORE_INFO",
          reason,
          actorAdminUserId: ctx.adminUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          subjectUserId: application.userId,
          entityType: "TEACHER_APPLICATION",
          entityId: applicationId,
          action: "UPDATE",
          sanitizedDiff: sanitizeAuditDiff({ status: "NEEDS_MORE_INFO", reason }),
        },
      });

      return app;
    });

    // 发送站内通知（事务外，不阻塞主流程）
    await this.sendNotification(
      application.userId,
      `teacher-audit:${applicationId}:needs-more-info:${now.getTime()}`,
      {
        action: "NEEDS_MORE_INFO",
        applicationId,
        reason,
      },
    );

    return updated;
  }

  /**
   * 批准申请。所有必需资质（IDENTITY + EDUCATION）PASS 后才能 APPROVED。
   * 在同一事务创建 TeacherProfile（不含 legalName 和 fileObjectId）、
   * 写 TeacherAuditRecord 和 AuditLog。
   */
  async approve(applicationId: string, ctx: AdminContext): Promise<ProfileRecord> {
    return this.database.$transaction(async (tx) => {
      const application = await tx.teacherApplication.findUnique({
        where: { id: applicationId },
      });
      if (!application) {
        throw new AppError("NOT_FOUND", 404, "Application not found");
      }
      if (application.status === "APPROVED") {
        throw new AppError("RESOURCE_CONFLICT", 409, "Application is already approved");
      }

      const qualifications = await tx.teacherQualification.findMany({
        where: { applicationId },
      });

      // 校验所有必需资质已通过
      for (const required of REQUIRED_QUALIFICATION_TYPES) {
        const quals = qualifications.filter((q) => q.type === required);
        if (quals.length === 0) {
          throw new AppError(
            "RESOURCE_CONFLICT",
            409,
            `Missing required qualification: ${required}`,
          );
        }
        const hasPass = quals.some((q) => q.reviewStatus === "PASS");
        if (!hasPass) {
          throw new AppError(
            "RESOURCE_CONFLICT",
            409,
            `Qualification ${required} has not passed review`,
          );
        }
      }

      // 更新申请状态
      await tx.teacherApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          version: application.version + 1,
        },
      });

      // 获取用户信息用于生成 displayName
      const user = await tx.user.findUnique({
        where: { id: application.userId },
      });

      // 创建公开资料（不含 legalName 和 fileObjectId）
      const profile = await tx.teacherProfile.create({
        data: {
          userId: application.userId,
          applicationId,
          displayName: deriveDisplayName(user, application.legalName),
          bio: application.bio ?? "",
          subjects: [],
          schoolStages: [],
          teachingModes: application.teachingModes,
          serviceAreaCodes: application.serviceAreaCode ? [application.serviceAreaCode] : [],
          teachingTags: [],
          experienceYears: application.experienceYears ?? 0,
          pricePerHour: application.pricePerHour ?? 0,
          serviceStatus: "ACTIVE",
          version: 0,
        },
      });

      // 写审核记录
      await tx.teacherAuditRecord.create({
        data: {
          applicationId,
          action: "APPROVE",
          reason: null,
          actorAdminUserId: ctx.adminUserId,
        },
      });

      // 写系统审计日志
      await tx.auditLog.create({
        data: {
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          subjectUserId: application.userId,
          entityType: "TEACHER_PROFILE",
          entityId: profile.id,
          action: "CREATE",
          sanitizedDiff: sanitizeAuditDiff({
            applicationId,
            displayName: profile.displayName,
            teachingModes: profile.teachingModes,
          }),
        },
      });

      return profile;
    });
  }

  /**
   * 暂停老师服务。PAUSED 状态保留已确认课程但不接受新推荐/预约。
   */
  async pause(applicationId: string, reason: string, ctx: AdminContext): Promise<ApplicationRecord> {
    return this.updateServiceStatus(applicationId, "PAUSED", reason, ctx);
  }

  /**
   * 封禁老师。BANNED 状态禁止老师工作区写操作。
   */
  async ban(applicationId: string, reason: string, ctx: AdminContext): Promise<ApplicationRecord> {
    return this.updateServiceStatus(applicationId, "BANNED", reason, ctx);
  }

  /**
   * 从暂停恢复到已批准状态。
   */
  async resume(applicationId: string, ctx: AdminContext): Promise<ApplicationRecord> {
    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }
    if (application.status !== "PAUSED") {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        `Cannot resume application in ${application.status} status`,
      );
    }

    return this.database.$transaction(async (tx) => {
      const updated = await tx.teacherApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          version: application.version + 1,
        },
      });

      // 恢复 TeacherProfile 服务状态
      const profile = await tx.teacherProfile.findUnique({
        where: { applicationId },
      });
      if (profile) {
        await tx.teacherProfile.update({
          where: { id: profile.id },
          data: {
            serviceStatus: "ACTIVE",
            version: profile.version + 1,
          },
        });
      }

      await tx.teacherAuditRecord.create({
        data: {
          applicationId,
          action: "RESUME",
          reason: null,
          actorAdminUserId: ctx.adminUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          subjectUserId: application.userId,
          entityType: "TEACHER_APPLICATION",
          entityId: applicationId,
          action: "UPDATE",
          sanitizedDiff: sanitizeAuditDiff({ status: "APPROVED", from: "PAUSED" }),
        },
      });

      return updated;
    });
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /**
   * 更新服务状态（暂停或封禁），同步 TeacherProfile 的 serviceStatus。
   */
  private async updateServiceStatus(
    applicationId: string,
    newStatus: TeacherApplicationStatus,
    reason: string,
    ctx: AdminContext,
  ): Promise<ApplicationRecord> {
    if (!reason || reason.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Reason is required");
    }

    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }

    const profileServiceStatus: TeacherServiceStatus =
      newStatus === "PAUSED" ? "PAUSED" : "BANNED";

    return this.database.$transaction(async (tx) => {
      const updated = await tx.teacherApplication.update({
        where: { id: applicationId },
        data: {
          status: newStatus,
          version: application.version + 1,
        },
      });

      // 同步更新 TeacherProfile 服务状态
      const profile = await tx.teacherProfile.findUnique({
        where: { applicationId },
      });
      if (profile) {
        await tx.teacherProfile.update({
          where: { id: profile.id },
          data: {
            serviceStatus: profileServiceStatus,
            version: profile.version + 1,
          },
        });
      }

      await tx.teacherAuditRecord.create({
        data: {
          applicationId,
          action: newStatus === "PAUSED" ? "PAUSE" : "BAN",
          reason,
          actorAdminUserId: ctx.adminUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          subjectUserId: application.userId,
          entityType: "TEACHER_APPLICATION",
          entityId: applicationId,
          action: "UPDATE",
          sanitizedDiff: sanitizeAuditDiff({ status: newStatus, reason }),
        },
      });

      return updated;
    });
  }

  /**
   * 发送站内通知（幂等）。
   */
  private async sendNotification(
    userId: string,
    dedupeKey: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    await this.database.notification.upsert({
      where: { dedupeKey },
      create: {
        userId,
        type: "TEACHER_AUDIT_UPDATE",
        dedupeKey,
        body,
        targetRoute: "/pages/teacher-apply/index",
        targetParams: null,
      },
      update: {},
    });
  }
}

// ─── 辅助函数 ───────────────────────────────────────────────

/**
 * 从用户信息和 legalName 生成脱敏的公开称呼。
 * 优先使用 User.displayName，否则取 legalName 首字 + "老师"。
 * 不返回完整 legalName。
 */
function deriveDisplayName(
  user: UserRecord | null,
  legalName: string,
): string {
  if (user?.displayName && user.displayName.trim().length > 0) {
    return user.displayName;
  }
  if (legalName.length > 0) {
    return legalName[0] + "老师";
  }
  return "老师";
}

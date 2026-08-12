/**
 * V2.3 老师自主申请与私有资质材料
 *
 * 纯老师（无 ParentProfile）也可创建申请草稿；提交前必须填写实名、学历、
 * 经历、价格、可授课方式，并上传身份证明和学历证明。资质文件使用
 * TEACHER_QUALIFICATION purpose 的私有 COS 对象，公开资料永不返回 fileObjectId。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type {
  TeacherApplicationStatus,
  QualificationType,
  QualificationReviewStatus,
  TeachingMode,
  FilePurpose,
  FileStatus,
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

type FileObjectRecord = {
  id: string;
  ownerUserId: string;
  purpose: FilePurpose;
  status: FileStatus;
};

export type ApplicationDetail = ApplicationRecord & {
  qualifications: QualificationRecord[];
};

// ─── 输入类型 ───────────────────────────────────────────────

export type ApplicationDraftInput = Partial<{
  legalName: string;
  education: string;
  experienceYears: number;
  pricePerHour: number;
  bio: string;
  teachingModes: TeachingMode[];
  serviceAreaCode: string;
}>;

export type AddQualificationInput = {
  type: QualificationType;
  fileObjectId: string;
};

// ─── 数据库接口 ─────────────────────────────────────────────

export interface ApplicationServiceDatabase {
  teacherApplication: {
    findFirst(args: {
      where: { userId: string; status: TeacherApplicationStatus };
    }): Promise<ApplicationRecord | null>;
    findUnique(args: { where: { id: string } }): Promise<ApplicationRecord | null>;
    findMany(args: {
      where: { userId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<ApplicationRecord[]>;
    create(args: {
      data: {
        userId: string;
        legalName: string;
        status: TeacherApplicationStatus;
        teachingModes: TeachingMode[];
        version: number;
      };
    }): Promise<ApplicationRecord>;
    update(args: {
      where: { id: string };
      data: Partial<{
        legalName: string;
        education: string;
        experienceYears: number;
        pricePerHour: number;
        bio: string;
        teachingModes: TeachingMode[];
        serviceAreaCode: string;
        status: TeacherApplicationStatus;
        version: number;
        submittedAt: Date;
      }>;
    }): Promise<ApplicationRecord>;
  };
  teacherQualification: {
    findMany(args: { where: { applicationId: string } }): Promise<QualificationRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<QualificationRecord | null>;
    create(args: {
      data: {
        applicationId: string;
        type: QualificationType;
        fileObjectId: string;
        reviewStatus: QualificationReviewStatus;
      };
    }): Promise<QualificationRecord>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  fileObject: {
    findUnique(args: { where: { id: string } }): Promise<FileObjectRecord | null>;
  };
}

// ─── 可编辑状态 ─────────────────────────────────────────────

const EDITABLE_STATUSES: TeacherApplicationStatus[] = ["DRAFT", "NEEDS_MORE_INFO"];

// 必需的资质类型：身份证明 + 学历证明
const REQUIRED_QUALIFICATION_TYPES: QualificationType[] = ["IDENTITY", "EDUCATION"];

// ─── 服务 ───────────────────────────────────────────────────

export class ApplicationService {
  constructor(
    private readonly database: ApplicationServiceDatabase = prisma as unknown as ApplicationServiceDatabase,
  ) {}

  /**
   * 获取或创建 DRAFT 状态的申请。
   * 纯老师无需 ParentProfile 也可创建。
   */
  async getOrCreateDraft(ctx: { userId: string }): Promise<ApplicationRecord> {
    const existing = await this.database.teacherApplication.findFirst({
      where: { userId: ctx.userId, status: "DRAFT" },
    });
    if (existing) return existing;

    return this.database.teacherApplication.create({
      data: {
        userId: ctx.userId,
        legalName: "",
        status: "DRAFT",
        teachingModes: [],
        version: 0,
      },
    });
  }

  /**
   * 更新草稿或补材料状态的申请。
   * 只允许 DRAFT 或 NEEDS_MORE_INFO 状态编辑；每次更新 version 递增。
   */
  async updateDraft(
    applicationId: string,
    userId: string,
    input: ApplicationDraftInput,
  ): Promise<ApplicationRecord> {
    const application = await this.requireOwnedApplication(applicationId, userId);
    this.assertEditable(application);

    const data: NonNullable<Parameters<ApplicationServiceDatabase["teacherApplication"]["update"]>[0]["data"]> = {};
    if (input.legalName !== undefined) data.legalName = input.legalName;
    if (input.education !== undefined) data.education = input.education;
    if (input.experienceYears !== undefined) data.experienceYears = input.experienceYears;
    if (input.pricePerHour !== undefined) data.pricePerHour = input.pricePerHour;
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.teachingModes !== undefined) data.teachingModes = input.teachingModes;
    if (input.serviceAreaCode !== undefined) data.serviceAreaCode = input.serviceAreaCode;

    if (Object.keys(data).length === 0) return application;

    data.version = application.version + 1;
    return this.database.teacherApplication.update({
      where: { id: applicationId },
      data,
    });
  }

  /**
   * 添加资质文件。文件 purpose 必须为 TEACHER_QUALIFICATION，校验文件归属。
   * 只允许 DRAFT 或 NEEDS_MORE_INFO 状态添加。
   */
  async addQualification(
    applicationId: string,
    userId: string,
    input: AddQualificationInput,
  ): Promise<QualificationRecord> {
    const application = await this.requireOwnedApplication(applicationId, userId);
    this.assertEditable(application);

    const file = await this.database.fileObject.findUnique({
      where: { id: input.fileObjectId },
    });
    if (!file) {
      throw new AppError("NOT_FOUND", 404, "Qualification file not found");
    }
    if (file.ownerUserId !== userId) {
      throw new AppError("FORBIDDEN", 403, "You cannot use this file");
    }
    if (file.purpose !== "TEACHER_QUALIFICATION") {
      throw new AppError("VALIDATION_ERROR", 400, "File purpose must be TEACHER_QUALIFICATION");
    }
    if (file.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", 400, "File is no longer active");
    }

    return this.database.teacherQualification.create({
      data: {
        applicationId,
        type: input.type,
        fileObjectId: input.fileObjectId,
        reviewStatus: "PENDING",
      },
    });
  }

  /**
   * 删除资质文件。只允许 DRAFT 或 NEEDS_MORE_INFO 状态删除。
   */
  async removeQualification(
    applicationId: string,
    userId: string,
    qualificationId: string,
  ): Promise<void> {
    const application = await this.requireOwnedApplication(applicationId, userId);
    this.assertEditable(application);

    const qualification = await this.database.teacherQualification.findUnique({
      where: { id: qualificationId },
    });
    if (!qualification || qualification.applicationId !== applicationId) {
      throw new AppError("NOT_FOUND", 404, "Qualification not found");
    }

    await this.database.teacherQualification.delete({
      where: { id: qualificationId },
    });
  }

  /**
   * 提交申请。校验必填字段和必需资质（IDENTITY + EDUCATION）。
   * 提交后状态变为 SUBMITTED，version 递增。
   */
  async submit(applicationId: string, userId: string): Promise<ApplicationRecord> {
    const application = await this.requireOwnedApplication(applicationId, userId);
    this.assertEditable(application);

    // 校验必填字段
    if (!application.legalName || application.legalName.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Legal name is required");
    }
    if (!application.education || application.education.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Education is required");
    }
    if (
      application.experienceYears === null ||
      application.experienceYears === undefined ||
      application.experienceYears < 0
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Experience years is required");
    }
    if (
      application.pricePerHour === null ||
      application.pricePerHour === undefined ||
      application.pricePerHour <= 0
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Price per hour is required");
    }
    if (!application.bio || application.bio.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Bio is required");
    }
    if (!application.teachingModes || application.teachingModes.length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "At least one teaching mode is required");
    }

    // 校验必需资质
    const qualifications = await this.database.teacherQualification.findMany({
      where: { applicationId },
    });
    const typesPresent = new Set(qualifications.map((q) => q.type));
    for (const required of REQUIRED_QUALIFICATION_TYPES) {
      if (!typesPresent.has(required)) {
        throw new AppError(
          "VALIDATION_ERROR",
          400,
          `Missing required qualification: ${required}`,
        );
      }
    }

    return this.database.teacherApplication.update({
      where: { id: applicationId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        version: application.version + 1,
      },
    });
  }

  /**
   * 获取用户的全部申请列表（按创建时间倒序）。
   */
  async getByUserId(userId: string): Promise<ApplicationRecord[]> {
    return this.database.teacherApplication.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 获取申请详情（含资质列表）。
   */
  async getById(applicationId: string): Promise<ApplicationDetail> {
    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }
    const qualifications = await this.database.teacherQualification.findMany({
      where: { applicationId },
    });
    return { ...application, qualifications };
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /**
   * 获取申请并校验归属权。
   */
  private async requireOwnedApplication(
    applicationId: string,
    userId: string,
  ): Promise<ApplicationRecord> {
    const application = await this.database.teacherApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }
    if (application.userId !== userId) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this application");
    }
    return application;
  }

  /**
   * 断言申请处于可编辑状态（DRAFT 或 NEEDS_MORE_INFO）。
   */
  private assertEditable(application: ApplicationRecord): void {
    if (!EDITABLE_STATUSES.includes(application.status)) {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        `Cannot modify application in ${application.status} status`,
      );
    }
  }
}

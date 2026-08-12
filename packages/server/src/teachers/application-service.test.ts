import { describe, expect, it } from "vitest";
import {
  ApplicationService,
  type ApplicationServiceDatabase,
  type ApplicationRecord,
  type QualificationRecord,
} from "./application-service";
import type {
  TeacherApplicationStatus,
  QualificationType,
  QualificationReviewStatus,
  TeachingMode,
  FilePurpose,
  FileStatus,
} from "@prisma/client";

// ─── 测试辅助 ───────────────────────────────────────────────

type FileObjectRecord = {
  id: string;
  ownerUserId: string;
  purpose: FilePurpose;
  status: FileStatus;
};

function createDatabase(
  applications: ApplicationRecord[],
  qualifications: QualificationRecord[],
  files: FileObjectRecord[],
): ApplicationServiceDatabase {
  let nextAppId = applications.length + 1;
  let nextQualId = qualifications.length + 1;

  return {
    teacherApplication: {
      findFirst: async ({ where }) =>
        applications.find(
          (a) => a.userId === where.userId && a.status === where.status,
        ) ?? null,
      findUnique: async ({ where }) =>
        applications.find((a) => a.id === where.id) ?? null,
      findMany: async ({ where }) =>
        applications
          .filter((a) => a.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      create: async ({ data }) => {
        const app: ApplicationRecord = {
          id: `app-${nextAppId++}`,
          userId: data.userId,
          status: data.status,
          legalName: data.legalName,
          education: null,
          experienceYears: null,
          pricePerHour: null,
          bio: null,
          teachingModes: data.teachingModes,
          serviceAreaCode: null,
          version: data.version,
          submittedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        applications.push(app);
        return app;
      },
      update: async ({ where, data }) => {
        const app = applications.find((a) => a.id === where.id);
        if (!app) throw new Error("missing application");
        Object.assign(app, data);
        return app;
      },
    },
    teacherQualification: {
      findMany: async ({ where }) =>
        qualifications.filter((q) => q.applicationId === where.applicationId),
      findUnique: async ({ where }) =>
        qualifications.find((q) => q.id === where.id) ?? null,
      create: async ({ data }) => {
        const qual: QualificationRecord = {
          id: `qual-${nextQualId++}`,
          applicationId: data.applicationId,
          type: data.type,
          fileObjectId: data.fileObjectId,
          reviewStatus: data.reviewStatus,
          reviewReason: null,
          reviewedAt: null,
          reviewedByAdminUserId: null,
          createdAt: new Date(),
        };
        qualifications.push(qual);
        return qual;
      },
      delete: async ({ where }) => {
        const idx = qualifications.findIndex((q) => q.id === where.id);
        if (idx >= 0) qualifications.splice(idx, 1);
        return {};
      },
    },
    fileObject: {
      findUnique: async ({ where }) =>
        files.find((f) => f.id === where.id) ?? null,
    },
  };
}

function makeApplication(
  overrides: Partial<ApplicationRecord> = {},
): ApplicationRecord {
  return {
    id: "app-1",
    userId: "user-a",
    status: "DRAFT",
    legalName: "",
    education: null,
    experienceYears: null,
    pricePerHour: null,
    bio: null,
    teachingModes: [],
    serviceAreaCode: null,
    version: 0,
    submittedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeQualification(
  overrides: Partial<QualificationRecord> = {},
): QualificationRecord {
  return {
    id: "qual-1",
    applicationId: "app-1",
    type: "IDENTITY",
    fileObjectId: "file-1",
    reviewStatus: "PENDING",
    reviewReason: null,
    reviewedAt: null,
    reviewedByAdminUserId: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeFile(overrides: Partial<FileObjectRecord> = {}): FileObjectRecord {
  return {
    id: "file-1",
    ownerUserId: "user-a",
    purpose: "TEACHER_QUALIFICATION",
    status: "ACTIVE",
    ...overrides,
  };
}

// ─── 测试 ───────────────────────────────────────────────────

describe("ApplicationService", () => {
  it("allows an account workspace without ParentProfile to draft an application", async () => {
    const applications: ApplicationRecord[] = [];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    const application = await service.getOrCreateDraft({ userId: "user-a" });

    expect(application.userId).toBe("user-a");
    expect(application.status).toBe("DRAFT");
    expect(application.version).toBe(0);
    // 纯老师无需 ParentProfile 即可创建申请
    expect(applications).toHaveLength(1);
  });

  it("returns the existing draft instead of creating a duplicate", async () => {
    const applications = [makeApplication({ id: "app-existing", userId: "user-a", status: "DRAFT" })];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    const application = await service.getOrCreateDraft({ userId: "user-a" });

    expect(application.id).toBe("app-existing");
    expect(applications).toHaveLength(1);
  });

  it("rejects submission without required qualifications (IDENTITY + EDUCATION)", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
        legalName: "张三",
        education: "本科",
        experienceYears: 5,
        pricePerHour: 200,
        bio: "经验丰富的数学老师",
        teachingModes: ["ONLINE"],
      }),
    ];
    // 只有 IDENTITY 资质，缺少 EDUCATION
    const qualifications = [
      makeQualification({ id: "qual-1", type: "IDENTITY", fileObjectId: "file-1" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, qualifications, []),
    );

    await expect(service.submit("app-1", "user-a")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects submission when no qualifications exist at all", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
        legalName: "张三",
        education: "本科",
        experienceYears: 5,
        pricePerHour: 200,
        bio: "经验丰富的数学老师",
        teachingModes: ["ONLINE"],
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    await expect(service.submit("app-1", "user-a")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects submission when required fields are missing", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
        legalName: "",
        education: null,
        experienceYears: null,
        pricePerHour: null,
        bio: null,
        teachingModes: [],
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    await expect(service.submit("app-1", "user-a")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("allows submission when all required fields and qualifications are present", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
        legalName: "张三",
        education: "本科",
        experienceYears: 5,
        pricePerHour: 200,
        bio: "经验丰富的数学老师",
        teachingModes: ["ONLINE"],
        version: 2,
      }),
    ];
    const qualifications = [
      makeQualification({ id: "qual-1", type: "IDENTITY", fileObjectId: "file-1" }),
      makeQualification({ id: "qual-2", type: "EDUCATION", fileObjectId: "file-2" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, qualifications, []),
    );

    const result = await service.submit("app-1", "user-a");

    expect(result.status).toBe("SUBMITTED");
    expect(result.version).toBe(3);
    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects update when status is SUBMITTED", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "SUBMITTED",
        legalName: "张三",
        version: 1,
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    await expect(
      service.updateDraft("app-1", "user-a", { bio: "新简介" }),
    ).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("rejects update when status is APPROVED", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "APPROVED",
        legalName: "张三",
        version: 3,
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    await expect(
      service.updateDraft("app-1", "user-a", { bio: "新简介" }),
    ).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("allows update when status is NEEDS_MORE_INFO", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "NEEDS_MORE_INFO",
        legalName: "张三",
        version: 1,
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    const result = await service.updateDraft("app-1", "user-a", { bio: "补充简介" });

    expect(result.bio).toBe("补充简介");
    expect(result.version).toBe(2);
  });

  it("increments version on each update", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
        version: 0,
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    await service.updateDraft("app-1", "user-a", { bio: "第一版" });
    expect(applications[0].version).toBe(1);

    await service.updateDraft("app-1", "user-a", { education: "硕士" });
    expect(applications[0].version).toBe(2);
  });

  it("rejects operations by non-owner", async () => {
    const applications = [
      makeApplication({
        id: "app-1",
        userId: "user-a",
        status: "DRAFT",
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    // 非所有者不能更新
    await expect(
      service.updateDraft("app-1", "user-b", { bio: "恶意修改" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    // 非所有者不能添加资质
    await expect(
      service.addQualification("app-1", "user-b", { type: "IDENTITY", fileObjectId: "file-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    // 非所有者不能删除资质
    await expect(
      service.removeQualification("app-1", "user-b", "qual-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    // 非所有者不能提交
    await expect(
      service.submit("app-1", "user-b"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects addQualification with wrong file purpose", async () => {
    const applications = [
      makeApplication({ id: "app-1", userId: "user-a", status: "DRAFT" }),
    ];
    const files = [
      makeFile({ id: "file-1", ownerUserId: "user-a", purpose: "ASSESSMENT_UPLOAD" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], files),
    );

    await expect(
      service.addQualification("app-1", "user-a", { type: "IDENTITY", fileObjectId: "file-1" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects addQualification with a file owned by another user", async () => {
    const applications = [
      makeApplication({ id: "app-1", userId: "user-a", status: "DRAFT" }),
    ];
    const files = [
      makeFile({ id: "file-1", ownerUserId: "user-b", purpose: "TEACHER_QUALIFICATION" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], files),
    );

    await expect(
      service.addQualification("app-1", "user-a", { type: "IDENTITY", fileObjectId: "file-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects removeQualification when status is SUBMITTED", async () => {
    const applications = [
      makeApplication({ id: "app-1", userId: "user-a", status: "SUBMITTED" }),
    ];
    const qualifications = [
      makeQualification({ id: "qual-1", applicationId: "app-1" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, qualifications, []),
    );

    await expect(
      service.removeQualification("app-1", "user-a", "qual-1"),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("returns application detail with qualifications in getById", async () => {
    const applications = [
      makeApplication({ id: "app-1", userId: "user-a", status: "DRAFT" }),
    ];
    const qualifications = [
      makeQualification({ id: "qual-1", applicationId: "app-1", type: "IDENTITY" }),
      makeQualification({ id: "qual-2", applicationId: "app-1", type: "EDUCATION" }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, qualifications, []),
    );

    const detail = await service.getById("app-1");

    expect(detail.id).toBe("app-1");
    expect(detail.qualifications).toHaveLength(2);
    expect(detail.qualifications.map((q) => q.type)).toEqual(["IDENTITY", "EDUCATION"]);
  });

  it("lists applications by user in descending creation order", async () => {
    const applications = [
      makeApplication({
        id: "app-old",
        userId: "user-a",
        createdAt: new Date("2026-01-01"),
      }),
      makeApplication({
        id: "app-new",
        userId: "user-a",
        createdAt: new Date("2026-02-01"),
      }),
      makeApplication({
        id: "app-other",
        userId: "user-b",
        createdAt: new Date("2026-03-01"),
      }),
    ];
    const service = new ApplicationService(
      createDatabase(applications, [], []),
    );

    const result = await service.getByUserId("user-a");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("app-new");
    expect(result[1].id).toBe("app-old");
  });
});

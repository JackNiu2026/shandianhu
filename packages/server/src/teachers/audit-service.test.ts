import { describe, expect, it } from "vitest";
import {
  AuditService,
  type TeacherAuditDatabase,
  type ApplicationRecord,
  type QualificationRecord,
  type AuditRecord,
  type ProfileRecord,
} from "./audit-service";
import type { AdminContext } from "../auth/role-context";
import type {
  TeacherApplicationStatus,
  QualificationType,
  QualificationReviewStatus,
  TeachingMode,
  TeacherServiceStatus,
  Subject,
  SchoolStage,
} from "@prisma/client";

// ─── 测试辅助 ───────────────────────────────────────────────

type UserRecord = { id: string; displayName: string | null };

type MockState = {
  applications: ApplicationRecord[];
  qualifications: QualificationRecord[];
  auditRecords: AuditRecord[];
  profiles: ProfileRecord[];
  users: UserRecord[];
  auditLogs: unknown[];
  notifications: unknown[];
};

function createAuditDatabase(state: MockState): TeacherAuditDatabase {
  let nextProfileId = state.profiles.length + 1;
  let nextAuditId = state.auditRecords.length + 1;

  const db: TeacherAuditDatabase = {
    teacherApplication: {
      findMany: async ({ where, orderBy }) =>
        state.applications
          .filter((a) => where.status.in.includes(a.status))
          .sort((a, b) =>
            orderBy.updatedAt === "desc"
              ? b.updatedAt.getTime() - a.updatedAt.getTime()
              : a.updatedAt.getTime() - b.updatedAt.getTime(),
          ),
      findUnique: async ({ where }) =>
        state.applications.find((a) => a.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const app = state.applications.find((a) => a.id === where.id);
        if (!app) throw new Error("missing application");
        Object.assign(app, data);
        return app;
      },
    },
    teacherQualification: {
      findMany: async ({ where }) =>
        state.qualifications.filter((q) => q.applicationId === where.applicationId),
      findUnique: async ({ where }) =>
        state.qualifications.find((q) => q.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const qual = state.qualifications.find((q) => q.id === where.id);
        if (!qual) throw new Error("missing qualification");
        Object.assign(qual, data);
        return qual;
      },
    },
    teacherAuditRecord: {
      findMany: async ({ where }) =>
        state.auditRecords
          .filter((r) => r.applicationId === where.applicationId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      create: async ({ data }) => {
        const record: AuditRecord = {
          id: `audit-${nextAuditId++}`,
          ...data,
          createdAt: new Date(),
        };
        state.auditRecords.push(record);
        return record;
      },
    },
    teacherProfile: {
      findUnique: async ({ where }) => {
        if ("id" in where) return state.profiles.find((p) => p.id === where.id) ?? null;
        if ("userId" in where) return state.profiles.find((p) => p.userId === where.userId) ?? null;
        if ("applicationId" in where)
          return state.profiles.find((p) => p.applicationId === where.applicationId) ?? null;
        return null;
      },
      create: async ({ data }) => {
        const profile: ProfileRecord = {
          id: `profile-${nextProfileId++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.profiles.push(profile);
        return profile;
      },
      update: async ({ where, data }) => {
        const profile = state.profiles.find((p) => p.id === where.id);
        if (!profile) throw new Error("missing profile");
        Object.assign(profile, data);
        return profile;
      },
    },
    user: {
      findUnique: async ({ where }) =>
        state.users.find((u) => u.id === where.id) ?? null,
    },
    auditLog: {
      create: async ({ data }) => {
        state.auditLogs.push(data);
        return {};
      },
    },
    notification: {
      upsert: async ({ create }) => {
        state.notifications.push(create);
        return {};
      },
    },
    $transaction: async <T>(callback: (tx: TeacherAuditDatabase) => Promise<T>): Promise<T> =>
      callback(db),
  };

  return db;
}

function makeApplication(
  overrides: Partial<ApplicationRecord> = {},
): ApplicationRecord {
  return {
    id: "app-1",
    userId: "user-a",
    status: "SUBMITTED",
    legalName: "张三丰",
    education: "本科",
    experienceYears: 5,
    pricePerHour: 200,
    bio: "经验丰富的数学老师",
    teachingModes: ["ONLINE"],
    serviceAreaCode: "110000",
    version: 1,
    submittedAt: new Date("2026-01-15"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-15"),
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
    fileObjectId: "file-qual-identity-123",
    reviewStatus: "PENDING",
    reviewReason: null,
    reviewedAt: null,
    reviewedByAdminUserId: null,
    createdAt: new Date("2026-01-15"),
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: "profile-1",
    userId: "user-a",
    applicationId: "app-1",
    displayName: "张老师",
    bio: "经验丰富的数学老师",
    subjects: [] as Subject[],
    schoolStages: [] as SchoolStage[],
    teachingModes: ["ONLINE"] as TeachingMode[],
    serviceAreaCodes: ["110000"],
    teachingTags: [],
    experienceYears: 5,
    pricePerHour: 200,
    serviceStatus: "ACTIVE" as TeacherServiceStatus,
    version: 0,
    createdAt: new Date("2026-01-20"),
    updatedAt: new Date("2026-01-20"),
    ...overrides,
  };
}

const adminCtx: AdminContext = { adminUserId: "admin-1", adminRole: "AUDITOR" };

// ─── 测试 ───────────────────────────────────────────────────

describe("AuditService (teacher)", () => {
  it("cannot approve while any required qualification is unverified", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [
        makeQualification({
          id: "qual-identity",
          type: "IDENTITY",
          fileObjectId: "file-identity-1",
          reviewStatus: "PASS",
        }),
        makeQualification({
          id: "qual-education",
          type: "EDUCATION",
          fileObjectId: "file-education-1",
          reviewStatus: "PENDING",
        }),
      ],
      auditRecords: [],
      profiles: [],
      users: [{ id: "user-a", displayName: null }],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(service.approve("app-1", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("cannot approve when a required qualification failed review", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [
        makeQualification({
          id: "qual-identity",
          type: "IDENTITY",
          reviewStatus: "PASS",
        }),
        makeQualification({
          id: "qual-education",
          type: "EDUCATION",
          reviewStatus: "FAIL",
          reviewReason: "照片模糊",
        }),
      ],
      auditRecords: [],
      profiles: [],
      users: [{ id: "user-a", displayName: null }],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(service.approve("app-1", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("cannot approve when a required qualification type is missing entirely", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [
        makeQualification({
          id: "qual-identity",
          type: "IDENTITY",
          reviewStatus: "PASS",
        }),
        // 缺少 EDUCATION 资质
      ],
      auditRecords: [],
      profiles: [],
      users: [{ id: "user-a", displayName: null }],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(service.approve("app-1", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("publishes only approved public fields (no legalName, no fileObjectId)", async () => {
    const legalName = "张三丰";
    const identityFileId = "file-qual-identity-xyz";
    const educationFileId = "file-qual-education-xyz";

    const state: MockState = {
      applications: [
        makeApplication({
          id: "app-1",
          status: "SUBMITTED",
          legalName,
          version: 2,
        }),
      ],
      qualifications: [
        makeQualification({
          id: "qual-identity",
          type: "IDENTITY",
          fileObjectId: identityFileId,
          reviewStatus: "PASS",
        }),
        makeQualification({
          id: "qual-education",
          type: "EDUCATION",
          fileObjectId: educationFileId,
          reviewStatus: "PASS",
        }),
      ],
      auditRecords: [],
      profiles: [],
      users: [{ id: "user-a", displayName: null }],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const profile = await service.approve("app-1", adminCtx);

    // 公开资料不含 legalName
    expect(JSON.stringify(profile)).not.toContain(legalName);
    // 公开资料不含 fileObjectId
    expect(JSON.stringify(profile)).not.toContain(identityFileId);
    expect(JSON.stringify(profile)).not.toContain(educationFileId);

    // 验证公开资料包含正确的公开字段
    expect(profile.userId).toBe("user-a");
    expect(profile.applicationId).toBe("app-1");
    expect(profile.displayName).toBe("张老师"); // 从 legalName 脱敏
    expect(profile.bio).toBe("经验丰富的数学老师");
    expect(profile.teachingModes).toEqual(["ONLINE"]);
    expect(profile.serviceAreaCodes).toEqual(["110000"]);
    expect(profile.experienceYears).toBe(5);
    expect(profile.pricePerHour).toBe(200);
    expect(profile.serviceStatus).toBe("ACTIVE");

    // 验证申请状态已更新
    expect(state.applications[0].status).toBe("APPROVED");
    expect(state.applications[0].version).toBe(3);

    // 验证写了审核记录和审计日志
    expect(state.auditRecords).toHaveLength(1);
    expect(state.auditRecords[0].action).toBe("APPROVE");
    expect(state.auditLogs).toHaveLength(1);
  });

  it("uses User.displayName when available for profile displayName", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "SUBMITTED", legalName: "李四" }),
      ],
      qualifications: [
        makeQualification({ id: "qual-1", type: "IDENTITY", reviewStatus: "PASS" }),
        makeQualification({ id: "qual-2", type: "EDUCATION", reviewStatus: "PASS" }),
      ],
      auditRecords: [],
      profiles: [],
      users: [{ id: "user-a", displayName: "王老师" }],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const profile = await service.approve("app-1", adminCtx);

    expect(profile.displayName).toBe("王老师");
    expect(JSON.stringify(profile)).not.toContain("李四");
  });

  it("pause and ban work correctly", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "APPROVED", version: 3 }),
      ],
      qualifications: [],
      auditRecords: [],
      profiles: [
        makeProfile({ id: "profile-1", applicationId: "app-1", version: 0 }),
      ],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    // 暂停
    const paused = await service.pause("app-1", "投诉待核实", adminCtx);
    expect(paused.status).toBe("PAUSED");
    expect(paused.version).toBe(4);
    expect(state.profiles[0].serviceStatus).toBe("PAUSED");
    expect(state.profiles[0].version).toBe(1);
    expect(state.auditRecords).toHaveLength(1);
    expect(state.auditRecords[0].action).toBe("PAUSE");
    expect(state.auditRecords[0].reason).toBe("投诉待核实");

    // 封禁（从 PAUSED 状态）
    const banned = await service.ban("app-1", "严重违规", adminCtx);
    expect(banned.status).toBe("BANNED");
    expect(banned.version).toBe(5);
    expect(state.profiles[0].serviceStatus).toBe("BANNED");
    expect(state.profiles[0].version).toBe(2);
    expect(state.auditRecords).toHaveLength(2);
    expect(state.auditRecords[1].action).toBe("BAN");
    expect(state.auditRecords[1].reason).toBe("严重违规");
  });

  it("resume restores from PAUSED to APPROVED", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "PAUSED", version: 4 }),
      ],
      qualifications: [],
      auditRecords: [],
      profiles: [
        makeProfile({
          id: "profile-1",
          applicationId: "app-1",
          serviceStatus: "PAUSED",
          version: 1,
        }),
      ],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const resumed = await service.resume("app-1", adminCtx);

    expect(resumed.status).toBe("APPROVED");
    expect(resumed.version).toBe(5);
    expect(state.profiles[0].serviceStatus).toBe("ACTIVE");
    expect(state.profiles[0].version).toBe(2);
    expect(state.auditRecords).toHaveLength(1);
    expect(state.auditRecords[0].action).toBe("RESUME");
  });

  it("resume rejects when not in PAUSED status", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "BANNED", version: 4 }),
      ],
      qualifications: [],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(service.resume("app-1", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("requestMoreInfo sets NEEDS_MORE_INFO and sends notification", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "SUBMITTED", version: 1, userId: "user-a" }),
      ],
      qualifications: [],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const result = await service.requestMoreInfo("app-1", "请补充学历证书背面", adminCtx);

    expect(result.status).toBe("NEEDS_MORE_INFO");
    expect(result.version).toBe(2);
    expect(state.auditRecords).toHaveLength(1);
    expect(state.auditRecords[0].action).toBe("REQUEST_MORE_INFO");
    expect(state.auditRecords[0].reason).toBe("请补充学历证书背面");
    expect(state.notifications).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("requestMoreInfo rejects when reason is empty", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(service.requestMoreInfo("app-1", "", adminCtx)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("reviewQualification updates qualification and writes audit records", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED", userId: "user-a" })],
      qualifications: [
        makeQualification({ id: "qual-1", applicationId: "app-1", type: "IDENTITY", reviewStatus: "PENDING" }),
      ],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const result = await service.reviewQualification("app-1", "qual-1", {
      status: "PASS",
      reason: "证件清晰有效",
    }, adminCtx);

    expect(result.reviewStatus).toBe("PASS");
    expect(result.reviewReason).toBe("证件清晰有效");
    expect(result.reviewedByAdminUserId).toBe("admin-1");
    expect(result.reviewedAt).toBeInstanceOf(Date);
    expect(state.auditRecords).toHaveLength(1);
    expect(state.auditRecords[0].action).toBe("REVIEW_PASS");
    expect(state.auditLogs).toHaveLength(1);
  });

  it("reviewQualification rejects when qualification does not belong to application", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [
        makeQualification({ id: "qual-1", applicationId: "app-other", type: "IDENTITY" }),
      ],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    await expect(
      service.reviewQualification("app-1", "qual-1", { status: "PASS" }, adminCtx),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("listPending returns only SUBMITTED and UNDER_REVIEW applications", async () => {
    const state: MockState = {
      applications: [
        makeApplication({ id: "app-1", status: "SUBMITTED", updatedAt: new Date("2026-02-01") }),
        makeApplication({ id: "app-2", status: "UNDER_REVIEW", updatedAt: new Date("2026-03-01") }),
        makeApplication({ id: "app-3", status: "APPROVED", updatedAt: new Date("2026-04-01") }),
        makeApplication({ id: "app-4", status: "DRAFT", updatedAt: new Date("2026-05-01") }),
      ],
      qualifications: [],
      auditRecords: [],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const result = await service.listPending(adminCtx);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["app-2", "app-1"]); // 按 updatedAt 倒序
  });

  it("getDetail returns application with qualifications and audit records", async () => {
    const state: MockState = {
      applications: [makeApplication({ id: "app-1", status: "SUBMITTED" })],
      qualifications: [
        makeQualification({ id: "qual-1", applicationId: "app-1", type: "IDENTITY" }),
        makeQualification({ id: "qual-2", applicationId: "app-1", type: "EDUCATION" }),
      ],
      auditRecords: [
        { id: "audit-1", applicationId: "app-1", action: "SUBMIT", reason: null, actorAdminUserId: null, createdAt: new Date("2026-01-15") },
      ],
      profiles: [],
      users: [],
      auditLogs: [],
      notifications: [],
    };
    const service = new AuditService(createAuditDatabase(state));

    const detail = await service.getDetail("app-1", adminCtx);

    expect(detail.id).toBe("app-1");
    expect(detail.qualifications).toHaveLength(2);
    expect(detail.auditRecords).toHaveLength(1);
  });
});

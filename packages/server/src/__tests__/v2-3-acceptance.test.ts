import { describe, expect, it } from "vitest";
import {
  ApplicationService,
  type ApplicationServiceDatabase,
  type ApplicationRecord,
  type QualificationRecord,
} from "../teachers/application-service";
import {
  AuditService,
  type TeacherAuditDatabase,
  type AuditRecord,
  type ProfileRecord,
} from "../teachers/audit-service";
import { hardFilter, scoreCompatibility } from "../recommendations/score";
import type {
  TeacherCandidate,
  ChildContextForMatch,
  RecommendationRequestInternal,
} from "../recommendations/types";
import { transition } from "../bookings/trial-state-machine";
import {
  FeedbackService,
  type FeedbackDatabase,
  type LessonRecord,
  type TeacherFeedbackRecord,
  type LearningEvidenceRecord,
  type FeedbackJobEnqueuer,
} from "../lessons/feedback-service";
import {
  ReviewService,
  type ReviewDatabase,
  type ParentReviewRecord,
} from "../lessons/review-service";
import {
  GrantService,
  type GrantServiceDatabase,
  type DataGrantRecord,
} from "../grants/grant-service";
import type { AdminContext } from "../auth/role-context";
import type {
  TeachingMode,
  FilePurpose,
  FileStatus,
  Subject,
  DataGrantScope,
  TeacherServiceStatus,
  TrialBookingStatus,
  LessonStatus,
} from "@prisma/client";

/**
 * V2.3 端到端验收测试
 *
 * 覆盖真人家教闭环关键路径（使用 mock prisma，不依赖真实数据库）：
 * - 纯老师无孩子可创建申请
 * - 提交校验
 * - 审核流程（逐项 PASS → APPROVED → 创建 TeacherProfile）
 * - 推荐硬筛选（剔除非 ACTIVE / 不匹配 subject / schoolStage）
 * - 试听状态机转换（REQUESTED → ACCEPTED → PARENT_CONFIRMED → READY → COMPLETED）
 * - DataGrant 最小读取（撤销后失效）
 * - 反馈唯一证据（同 operationKey 幂等，不重复 evidence）
 * - 真实评价绑定（评价必须绑定已完成 lesson 且属于自己孩子）
 */

// ─── 测试辅助 ───────────────────────────────────────────────

type FileObjectRecord = {
  id: string;
  ownerUserId: string;
  purpose: FilePurpose;
  status: FileStatus;
};

function makeApplication(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    id: "app-1",
    userId: "user-teacher",
    status: "DRAFT",
    legalName: "",
    education: null,
    experienceYears: null,
    pricePerHour: null,
    bio: null,
    teachingModes: [] as TeachingMode[],
    serviceAreaCode: null,
    version: 0,
    submittedAt: null,
    createdAt: new Date("2026-08-09T00:00:00Z"),
    updatedAt: new Date("2026-08-09T00:00:00Z"),
    ...overrides,
  };
}

function makeQualification(overrides: Partial<QualificationRecord> = {}): QualificationRecord {
  return {
    id: "qual-1",
    applicationId: "app-1",
    type: "IDENTITY",
    fileObjectId: "file-1",
    reviewStatus: "PENDING",
    reviewReason: null,
    reviewedAt: null,
    reviewedByAdminUserId: null,
    createdAt: new Date("2026-08-09T00:00:00Z"),
    ...overrides,
  };
}

const adminCtx: AdminContext = {
  adminUserId: "admin-1",
  role: "SUPERADMIN",
};

// ─── 测试用例 ───────────────────────────────────────────────

describe("V2.3 端到端验收：真人家教闭环", () => {
  describe("纯老师无孩子可创建申请", () => {
    it("allows an account without ParentProfile to draft an application", async () => {
      const applications: ApplicationRecord[] = [];
      const qualifications: QualificationRecord[] = [];
      const files: FileObjectRecord[] = [];
      const db = createApplicationDatabase(applications, qualifications, files);
      const service = new ApplicationService(db);

      const app = await service.getOrCreateDraft({ userId: "user-teacher" });
      expect(app.userId).toBe("user-teacher");
      expect(app.status).toBe("DRAFT");
      expect(app.legalName).toBe("");
    });
  });

  describe("提交校验", () => {
    it("rejects submission without required fields", async () => {
      const applications = [makeApplication({ status: "DRAFT" })];
      const db = createApplicationDatabase(applications, [], []);
      const service = new ApplicationService(db);

      await expect(service.submit("app-1", "user-teacher"))
        .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects submission without IDENTITY and EDUCATION qualifications", async () => {
      const applications = [makeApplication({
        status: "DRAFT",
        legalName: "张三",
        education: "本科",
        experienceYears: 5,
        pricePerHour: 200,
        bio: "资深数学老师",
        teachingModes: ["ONLINE"],
      })];
      const db = createApplicationDatabase(applications, [], []);
      const service = new ApplicationService(db);

      await expect(service.submit("app-1", "user-teacher"))
        .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("审核流程", () => {
    it("cannot approve while any required qualification is unverified", async () => {
      const applications = [makeApplication({ status: "SUBMITTED" })];
      const qualifications = [
        makeQualification({ id: "q-1", type: "IDENTITY", reviewStatus: "PENDING" }),
        makeQualification({ id: "q-2", type: "EDUCATION", reviewStatus: "PENDING" }),
      ];
      const state = {
        applications,
        qualifications,
        auditRecords: [] as AuditRecord[],
        profiles: [] as ProfileRecord[],
        users: [{ id: "user-teacher", displayName: null }],
        auditLogs: [] as unknown[],
        notifications: [] as unknown[],
      };
      const db = createAuditDatabase(state);
      const svc = new AuditService(db);

      await expect(svc.approve("app-1", adminCtx))
        .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
    });

    it("approves after IDENTITY and EDUCATION both PASS, creates public profile", async () => {
      const applications = [makeApplication({ status: "SUBMITTED" })];
      const qualifications = [
        makeQualification({ id: "q-1", type: "IDENTITY", reviewStatus: "PASS" }),
        makeQualification({ id: "q-2", type: "EDUCATION", reviewStatus: "PASS" }),
      ];
      const state = {
        applications,
        qualifications,
        auditRecords: [] as AuditRecord[],
        profiles: [] as ProfileRecord[],
        users: [{ id: "user-teacher", displayName: "张老师" }],
        auditLogs: [] as unknown[],
        notifications: [] as unknown[],
      };
      const db = createAuditDatabase(state);
      const svc = new AuditService(db);

      const profile = await svc.approve("app-1", adminCtx);
      expect(profile.userId).toBe("user-teacher");
      expect(profile.serviceStatus).toBe("ACTIVE");
      // 公开资料不应包含 legalName
      expect(JSON.stringify(profile)).not.toContain("张三");
      // 申请状态变为 APPROVED
      expect(applications[0].status).toBe("APPROVED");
    });
  });

  describe("推荐硬筛选", () => {
    it("filters out inactive teachers and wrong subject/stage", () => {
      const child: ChildContextForMatch = {
        childId: "child-1",
        grade: "G6",
        schoolStage: "PRIMARY",
        subject: "MATH",
        weakKnowledgePoints: ["分数"],
        learningGoals: [],
        teachingPreferences: [],
        serviceAreaCode: null,
      };
      const request: RecommendationRequestInternal = { child };
      const candidates: TeacherCandidate[] = [
        {
          id: "t-active",
          displayName: "张老师",
          subjects: ["MATH"],
          schoolStages: ["PRIMARY"],
          teachingModes: ["ONLINE"],
          serviceAreaCodes: [],
          teachingTags: [],
          experienceYears: 5,
          pricePerHour: 200,
          serviceStatus: "ACTIVE",
        },
        {
          id: "t-paused",
          displayName: "李老师",
          subjects: ["MATH"],
          schoolStages: ["PRIMARY"],
          teachingModes: ["ONLINE"],
          serviceAreaCodes: [],
          teachingTags: [],
          experienceYears: 3,
          pricePerHour: 150,
          serviceStatus: "PAUSED",
        },
        {
          id: "t-wrong-subject",
          displayName: "王老师",
          subjects: ["CHINESE"],
          schoolStages: ["PRIMARY"],
          teachingModes: ["ONLINE"],
          serviceAreaCodes: [],
          teachingTags: [],
          experienceYears: 8,
          pricePerHour: 180,
          serviceStatus: "ACTIVE",
        },
        {
          id: "t-wrong-stage",
          displayName: "赵老师",
          subjects: ["MATH"],
          schoolStages: ["JUNIOR"],
          teachingModes: ["ONLINE"],
          serviceAreaCodes: [],
          teachingTags: [],
          experienceYears: 10,
          pricePerHour: 250,
          serviceStatus: "ACTIVE",
        },
      ];

      const filtered = hardFilter(candidates, request);
      const ids = filtered.map((c) => c.id);
      expect(ids).toEqual(["t-active"]);
    });

    it("scoreCompatibility is deterministic for the same input", () => {
      const teacher = {
        id: "t-score",
        subjects: ["MATH" as Subject],
        schoolStages: ["MIDDLE" as const],
        teachingModes: ["ONLINE" as const],
        serviceAreaCodes: [],
        teachingTags: ["分步讲解", "分数"],
        experienceYears: 10,
        pricePerHour: 200,
        serviceStatus: "ACTIVE" as const,
      };
      const request = {
        child: {
          subject: "MATH" as Subject,
          schoolStage: "MIDDLE" as const,
          teachingPreferences: ["分步讲解"],
          weakKnowledgePoints: ["分数"],
        },
        preferredMode: "ONLINE" as const,
        budgetMaxPerHour: 250,
      };
      const a = scoreCompatibility(teacher, request, true);
      const b = scoreCompatibility(teacher, request, true);
      expect(a).toEqual(b);
      expect(a.total).toBeGreaterThan(0);
    });
  });

  describe("试听状态机转换", () => {
    it("supports REQUESTED → ACCEPTED → PARENT_CONFIRMED → READY → COMPLETED", () => {
      expect(transition("REQUESTED", "ACCEPT")).toBe("ACCEPTED");
      expect(transition("ACCEPTED", "PARENT_CONFIRM")).toBe("PARENT_CONFIRMED");
      expect(transition("PARENT_CONFIRMED", "MARK_READY")).toBe("READY");
      expect(transition("READY", "COMPLETE")).toBe("COMPLETED");
    });

    it("rejects illegal transitions from terminal states", () => {
      expect(() => transition("COMPLETED", "ACCEPT")).toThrow();
      expect(() => transition("REJECTED", "ACCEPT")).toThrow();
      expect(() => transition("CANCELLED", "ACCEPT")).toThrow();
    });

    it("allows CANCEL from any non-terminal state", () => {
      expect(transition("REQUESTED", "CANCEL")).toBe("CANCELLED");
      expect(transition("ACCEPTED", "CANCEL")).toBe("CANCELLED");
      expect(transition("READY", "CANCEL")).toBe("CANCELLED");
    });
  });

  describe("DataGrant 最小读取", () => {
    it("grant can be revoked and becomes invalid", async () => {
      const now = new Date("2026-08-10T00:00:00Z");
      const grants: DataGrantRecord[] = [
        {
          id: "grant-1",
          parentProfileId: "parent-1",
          childId: "child-1",
          teacherProfileId: "teacher-1",
          scopes: ["BASIC_PROFILE", "LEARNING_NEEDS"] as DataGrantScope[],
          validFrom: now,
          validUntil: null,
          revokedAt: null,
          sourceBookingId: "booking-1",
          createdAt: now,
          updatedAt: now,
        },
      ];
      const state = {
        grants,
        teachers: [{ id: "teacher-1", userId: "user-teacher", displayName: "张老师", serviceStatus: "ACTIVE" as TeacherServiceStatus }],
        children: [{ id: "child-1", parentProfileId: "parent-1", name: "小明", grade: "G6", schoolName: null, learningGoals: [], deletedAt: null }],
        trialBookings: [],
        lessons: [],
        summaries: [],
        users: [{ id: "user-teacher" }],
        notifications: [],
      };
      const db = createGrantDatabase(state);
      const svc = new GrantService(db, () => now);

      // 撤销 grant
      await svc.revoke("parent-1", "grant-1");
      expect(grants[0].revokedAt).toEqual(now);
    });
  });

  describe("反馈唯一证据", () => {
    it("submitting same operationKey twice returns the same feedback (idempotent)", async () => {
      const lessons: LessonRecord[] = [
        {
          id: "lesson-1",
          childId: "child-1",
          teacherProfileId: "teacher-1",
          status: "COMPLETED",
          completedAt: new Date("2026-08-10T03:00:00Z"),
        },
      ];
      const state = {
        lessons,
        feedbacks: [] as TeacherFeedbackRecord[],
        evidences: [] as LearningEvidenceRecord[],
        parents: [{ id: "parent-1", userId: "user-parent", displayName: "张三" }],
        children: [{ id: "child-1", parentProfileId: "parent-1" }],
        notifications: [] as unknown[],
      };
      const db = createFeedbackDatabase(state);
      const jobEnqueuer: FeedbackJobEnqueuer = {
        enqueue: async () => ({}),
      };
      const svc = new FeedbackService(db, jobEnqueuer);

      const input = {
        lessonContent: ["分数加减法"],
        performance: "MEETS_EXPECTED" as const,
        difficulties: ["通分"],
        suggestions: ["多练习异分母"],
        privateTeacherNote: "建议家长陪同复习",
      };

      const first = await svc.submit("teacher-1", "lesson-1", "op-key-1", input);
      const second = await svc.submit("teacher-1", "lesson-1", "op-key-1", input);

      expect(first.id).toBe(second.id);
      // 只应有一条 evidence
      expect(state.evidences.length).toBe(1);
    });
  });

  describe("真实评价绑定", () => {
    it("rejects review for a lesson that does not belong to the parent's child", async () => {
      const state = {
        lessons: [
          {
            id: "lesson-1",
            childId: "child-other",
            teacherProfileId: "teacher-1",
            status: "COMPLETED" as const,
          },
        ],
        reviews: [] as ParentReviewRecord[],
        parents: [{ id: "parent-1", userId: "user-parent", displayName: "张三" }],
        children: [{ id: "child-1", parentProfileId: "parent-1" }],
        teachers: [{ id: "teacher-1", userId: "user-teacher" }],
        notifications: [] as unknown[],
      };
      const db = createReviewDatabase(state);
      const svc = new ReviewService(db);

      await expect(
        svc.create("parent-1", "lesson-1", { rating: 5, content: "非常满意的教学效果" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects review for an incomplete lesson", async () => {
      const state = {
        lessons: [
          {
            id: "lesson-1",
            childId: "child-1",
            teacherProfileId: "teacher-1",
            status: "SCHEDULED" as const,
          },
        ],
        reviews: [] as ParentReviewRecord[],
        parents: [{ id: "parent-1", userId: "user-parent", displayName: "张三" }],
        children: [{ id: "child-1", parentProfileId: "parent-1" }],
        teachers: [{ id: "teacher-1", userId: "user-teacher" }],
        notifications: [] as unknown[],
      };
      const db = createReviewDatabase(state);
      const svc = new ReviewService(db);

      await expect(
        svc.create("parent-1", "lesson-1", { rating: 5, content: "非常满意的教学效果" }),
      ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
    });

    it("creates review for a completed lesson owned by the parent", async () => {
      const state = {
        lessons: [
          {
            id: "lesson-1",
            childId: "child-1",
            teacherProfileId: "teacher-1",
            status: "COMPLETED" as const,
          },
        ],
        reviews: [] as ParentReviewRecord[],
        parents: [{ id: "parent-1", userId: "user-parent", displayName: "张三" }],
        children: [{ id: "child-1", parentProfileId: "parent-1" }],
        teachers: [{ id: "teacher-1", userId: "user-teacher" }],
        notifications: [] as unknown[],
      };
      const db = createReviewDatabase(state);
      const svc = new ReviewService(db);

      const review = await svc.create("parent-1", "lesson-1", {
        rating: 5,
        content: "非常满意的教学效果，孩子进步明显",
      });
      expect(review.rating).toBe(5);
      expect(review.authorDisplayName).toBe("张家长");
      expect(state.reviews.length).toBe(1);
    });
  });
});

// ─── mock 数据库工厂 ───────────────────────────────────────

function createApplicationDatabase(
  applications: ApplicationRecord[],
  qualifications: QualificationRecord[],
  files: FileObjectRecord[],
): ApplicationServiceDatabase {
  let nextAppId = applications.length + 1;
  let nextQualId = qualifications.length + 1;

  return {
    teacherApplication: {
      findFirst: async ({ where }) =>
        applications.find((a) => a.userId === where.userId && a.status === where.status) ?? null,
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

function createAuditDatabase(state: {
  applications: ApplicationRecord[];
  qualifications: QualificationRecord[];
  auditRecords: AuditRecord[];
  profiles: ProfileRecord[];
  users: { id: string; displayName: string | null }[];
  auditLogs: unknown[];
  notifications: unknown[];
}): TeacherAuditDatabase {
  let nextProfileId = state.profiles.length + 1;
  let nextAuditId = state.auditRecords.length + 1;

  return {
    teacherApplication: {
      findMany: async ({ where }) =>
        state.applications.filter((a) => where.status.in.includes(a.status)),
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
        state.auditRecords.filter((r) => r.applicationId === where.applicationId),
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
        if ("applicationId" in where) return state.profiles.find((p) => p.applicationId === where.applicationId) ?? null;
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
    $transaction: async <T>(callback: (tx: TeacherAuditDatabase) => Promise<T>): Promise<T> => {
      return callback(createAuditDatabase(state));
    },
  };
}

function createFeedbackDatabase(state: {
  lessons: LessonRecord[];
  feedbacks: TeacherFeedbackRecord[];
  evidences: LearningEvidenceRecord[];
  parents: { id: string; userId: string; displayName: string | null }[];
  children: { id: string; parentProfileId: string }[];
  notifications: unknown[];
}): FeedbackDatabase {
  let nextFeedbackId = state.feedbacks.length + 1;
  let nextEvidenceId = state.evidences.length + 1;

  return {
    lesson: {
      findUnique: async ({ where }) =>
        state.lessons.find((l) => l.id === where.id) ?? null,
    },
    teacherFeedback: {
      findFirst: async ({ where, orderBy }) => {
        let items = state.feedbacks.filter((f) => f.lessonId === where.lessonId);
        if (where.isCurrent !== undefined) {
          items = items.filter((f) => f.isCurrent === where.isCurrent);
        }
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items[0] ?? null;
      },
      findMany: async ({ where, orderBy }) => {
        let items = state.feedbacks.filter((f) => f.lessonId === where.lessonId);
        if (orderBy.sequence === "desc") {
          items = items.slice().sort((a, b) => b.sequence - a.sequence);
        } else {
          items = items.slice().sort((a, b) => a.sequence - b.sequence);
        }
        return items;
      },
      create: async ({ data }) => {
        const feedback: TeacherFeedbackRecord = {
          id: `fb-${nextFeedbackId++}`,
          ...data,
          createdAt: new Date(),
        };
        state.feedbacks.push(feedback);
        return feedback;
      },
      update: async ({ where, data }) => {
        const fb = state.feedbacks.find((f) => f.id === where.id);
        if (!fb) throw new Error("missing feedback");
        Object.assign(fb, data);
        return fb;
      },
    },
    learningEvidence: {
      findFirst: async ({ where }) =>
        state.evidences.find(
          (e) => e.childId === where.childId && e.source === where.source && e.sourceId === where.sourceId,
        ) ?? null,
      create: async ({ data }) => {
        const ev: LearningEvidenceRecord = {
          id: `ev-${nextEvidenceId++}`,
          ...data,
          revokedAt: null,
          createdAt: new Date(),
        };
        state.evidences.push(ev);
        return ev;
      },
      update: async ({ where, data }) => {
        const ev = state.evidences.find((e) => e.id === where.id);
        if (!ev) throw new Error("missing evidence");
        Object.assign(ev, data);
        return ev;
      },
    },
    parentProfile: {
      findUnique: async ({ where }) =>
        state.parents.find((p) => p.id === where.id) ?? null,
    },
    child: {
      findUnique: async ({ where }) =>
        state.children.find((c) => c.id === where.id) ?? null,
    },
    notification: {
      upsert: async ({ create }) => {
        state.notifications.push(create);
        return {};
      },
    },
    $transaction: async <T>(callback: (tx: FeedbackDatabase) => Promise<T>): Promise<T> => {
      return callback(createFeedbackDatabase(state));
    },
  };
}

function createReviewDatabase(state: {
  lessons: { id: string; childId: string; teacherProfileId: string; status: LessonStatus }[];
  reviews: ParentReviewRecord[];
  parents: { id: string; userId: string; displayName: string | null }[];
  children: { id: string; parentProfileId: string }[];
  teachers: { id: string; userId: string }[];
  notifications: unknown[];
}): ReviewDatabase {
  let nextReviewId = state.reviews.length + 1;

  return {
    lesson: {
      findUnique: async ({ where }) =>
        state.lessons.find((l) => l.id === where.id) ?? null,
    },
    parentReview: {
      findUnique: async ({ where }) =>
        state.reviews.find((r) => r.lessonId === where.lessonId) ?? null,
      findMany: async ({ where, orderBy }) => {
        let items = state.reviews.slice();
        if (where.teacherProfileId) items = items.filter((r) => r.teacherProfileId === where.teacherProfileId);
        if (where.parentProfileId) items = items.filter((r) => r.parentProfileId === where.parentProfileId);
        if (orderBy.createdAt === "desc") {
          items = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items;
      },
      create: async ({ data }) => {
        const review: ParentReviewRecord = {
          id: `rev-${nextReviewId++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.reviews.push(review);
        return review;
      },
    },
    parentProfile: {
      findUnique: async ({ where }) =>
        state.parents.find((p) => p.id === where.id) ?? null,
    },
    child: {
      findUnique: async ({ where }) =>
        state.children.find((c) => c.id === where.id) ?? null,
    },
    teacherProfile: {
      findUnique: async ({ where }) =>
        state.teachers.find((t) => t.id === where.id) ?? null,
    },
    notification: {
      upsert: async ({ create }) => {
        state.notifications.push(create);
        return {};
      },
    },
  };
}

function createGrantDatabase(state: {
  grants: DataGrantRecord[];
  teachers: { id: string; userId: string; displayName: string; serviceStatus: TeacherServiceStatus }[];
  children: { id: string; parentProfileId: string; name: string; grade: string | null; schoolName: string | null; learningGoals: string[]; deletedAt: Date | null }[];
  trialBookings: { id: string; parentProfileId: string; childId: string; teacherProfileId: string; subject: Subject; startsAt: Date; endsAt: Date; status: TrialBookingStatus }[];
  lessons: { id: string; childId: string; teacherProfileId: string; subject: Subject; startsAt: Date; status: LessonStatus }[];
  summaries: { id: string; childId: string; summary: unknown; createdAt: Date }[];
  users: { id: string }[];
  notifications: unknown[];
}): GrantServiceDatabase {
  return {
    dataGrant: {
      create: async ({ data }) => {
        const grant: DataGrantRecord = {
          id: `grant-${state.grants.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.grants.push(grant);
        return grant;
      },
      findFirst: async ({ where }) =>
        state.grants.find(
          (g) =>
            g.teacherProfileId === where.teacherProfileId &&
            g.childId === where.childId &&
            g.revokedAt === where.revokedAt,
        ) ?? null,
      findMany: async ({ where }) => {
        if ("parentProfileId" in where) {
          return state.grants.filter((g) => g.parentProfileId === where.parentProfileId);
        }
        return state.grants.filter((g) => g.teacherProfileId === where.teacherProfileId);
      },
      findUnique: async ({ where }) =>
        state.grants.find((g) => g.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const grant = state.grants.find((g) => g.id === where.id);
        if (!grant) throw new Error("missing grant");
        Object.assign(grant, data);
        return grant;
      },
    },
    teacherProfile: {
      findUnique: async ({ where }) =>
        state.teachers.find((t) => t.id === where.id) ?? null,
    },
    child: {
      findUnique: async ({ where }) =>
        state.children.find((c) => c.id === where.id) ?? null,
    },
    trialBooking: {
      findFirst: async () => state.trialBookings[0] ?? null,
      findMany: async () => state.trialBookings,
      findUnique: async ({ where }) =>
        state.trialBookings.find((b) => b.id === where.id) ?? null,
    },
    lesson: {
      findFirst: async () => state.lessons[0] ?? null,
      findMany: async () => state.lessons,
    },
    tutoringSummary: {
      findMany: async ({ where }) =>
        state.summaries.filter((s) => s.childId === where.childId),
    },
    parentProfile: {
      findUnique: async () => null,
    },
    user: {
      findUnique: async ({ where }) =>
        state.users.find((u) => u.id === where.id) ?? null,
    },
    notification: {
      upsert: async ({ create }) => {
        state.notifications.push(create);
        return {};
      },
    },
  } as unknown as GrantServiceDatabase;
}

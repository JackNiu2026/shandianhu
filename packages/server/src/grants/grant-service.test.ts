import { describe, expect, it } from "vitest";
import type { Subject } from "@prisma/client";
import {
  GrantService,
  type GrantServiceDatabase,
  type DataGrantRecord,
  type GrantTransactionClient,
} from "./grant-service";

// ─── 测试辅助类型 ───────────────────────────────────────────

type TeacherProfileRecord = {
  id: string;
  userId: string;
  displayName: string;
  serviceStatus: "ACTIVE" | "PAUSED" | "BANNED";
};

type ChildRecord = {
  id: string;
  parentProfileId: string;
  name: string;
  grade: string | null;
  schoolName: string | null;
  learningGoals: string[];
  deletedAt: Date | null;
};

type TrialBookingRecord = {
  id: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  status:
    | "REQUESTED" | "ACCEPTED" | "RESCHEDULE_PROPOSED" | "REJECTED"
    | "PARENT_CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";
};

type LessonRecord = {
  id: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
};

type TutoringSummaryRecord = {
  id: string;
  childId: string;
  summary: unknown;
  createdAt: Date;
};

type UserRecord = { id: string };

interface MockState {
  grants: DataGrantRecord[];
  teachers: TeacherProfileRecord[];
  children: ChildRecord[];
  trialBookings: TrialBookingRecord[];
  lessons: LessonRecord[];
  summaries: TutoringSummaryRecord[];
  users: UserRecord[];
  notifications: unknown[];
}

// ─── mock 数据库 ────────────────────────────────────────────

function createDatabase(state: MockState): GrantServiceDatabase {
  let nextGrantId = state.grants.length + 1;

  const db: GrantServiceDatabase = {
    dataGrant: {
      create: async ({ data }) => {
        const now = new Date();
        const grant: DataGrantRecord = {
          id: `grant-${nextGrantId++}`,
          parentProfileId: data.parentProfileId,
          childId: data.childId,
          teacherProfileId: data.teacherProfileId,
          scopes: data.scopes,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
          revokedAt: data.revokedAt,
          sourceBookingId: data.sourceBookingId,
          createdAt: now,
          updatedAt: now,
        };
        state.grants.push(grant);
        return grant;
      },
      findFirst: async ({ where, orderBy }) => {
        const { teacherProfileId, childId, revokedAt } = where;
        let items = state.grants.filter(
          (g) =>
            g.teacherProfileId === teacherProfileId &&
            g.childId === childId &&
            (revokedAt === null ? g.revokedAt === null : g.revokedAt === revokedAt),
        );
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items[0] ?? null;
      },
      findMany: async ({ where, orderBy }) => {
        let items: DataGrantRecord[];
        if ("parentProfileId" in where) {
          items = state.grants.filter((g) => g.parentProfileId === where.parentProfileId);
        } else {
          items = state.grants.filter((g) => g.teacherProfileId === where.teacherProfileId);
        }
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items;
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
      findFirst: async ({ where, orderBy }) => {
        let items = state.trialBookings.filter((b) => {
          if (where.childId && b.childId !== where.childId) return false;
          if (where.teacherProfileId && b.teacherProfileId !== where.teacherProfileId) return false;
          if (where.status?.in && !where.status.in.includes(b.status)) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
        }
        return items[0] ?? null;
      },
      findMany: async ({ where, orderBy }) => {
        let items = state.trialBookings.filter((b) => {
          if (where.teacherProfileId && b.teacherProfileId !== where.teacherProfileId) return false;
          if (where.status?.in && !where.status.in.includes(b.status)) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
        }
        return items;
      },
      findUnique: async ({ where }) =>
        state.trialBookings.find((b) => b.id === where.id) ?? null,
    },
    lesson: {
      findFirst: async ({ where, orderBy }) => {
        let items = state.lessons.filter((l) => {
          if (where.childId && l.childId !== where.childId) return false;
          if (where.teacherProfileId && l.teacherProfileId !== where.teacherProfileId) return false;
          if (where.status?.in && !where.status.in.includes(l.status)) return false;
          return true;
        });
        if (orderBy?.startsAt === "asc") {
          items = items.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        }
        return items[0] ?? null;
      },
      findMany: async ({ where, orderBy }) => {
        let items = state.lessons.filter((l) => {
          if (where.teacherProfileId && l.teacherProfileId !== where.teacherProfileId) return false;
          if (where.status?.in && !where.status.in.includes(l.status)) return false;
          return true;
        });
        if (orderBy?.startsAt === "asc") {
          items = items.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        }
        return items;
      },
    },
    tutoringSummary: {
      findMany: async ({ where, orderBy, take }) => {
        let items = state.summaries.filter((s) => s.childId === where.childId);
        if (orderBy?.createdAt === "desc") {
          items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (take !== undefined) items = items.slice(0, take);
        return items;
      },
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
  };

  return db;
}

// ─── 工厂方法 ──────────────────────────────────────────────

function makeGrant(overrides: Partial<DataGrantRecord> = {}): DataGrantRecord {
  return {
    id: "grant-1",
    parentProfileId: "parent-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    scopes: ["BASIC_PROFILE", "LEARNING_NEEDS"],
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    revokedAt: null,
    sourceBookingId: "booking-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeTeacher(overrides: Partial<TeacherProfileRecord> = {}): TeacherProfileRecord {
  return {
    id: "teacher-1",
    userId: "user-teacher-1",
    displayName: "张老师",
    serviceStatus: "ACTIVE",
    ...overrides,
  };
}

function makeChild(overrides: Partial<ChildRecord> = {}): ChildRecord {
  return {
    id: "child-1",
    parentProfileId: "parent-1",
    name: "小明",
    grade: "三年级",
    schoolName: "某某小学",
    learningGoals: ["逻辑思维", "计算准确"],
    deletedAt: null,
    ...overrides,
  };
}

function makeTrial(overrides: Partial<TrialBookingRecord> = {}): TrialBookingRecord {
  return {
    id: "booking-1",
    parentProfileId: "parent-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    subject: "MATH",
    startsAt: new Date("2026-02-01T10:00:00Z"),
    endsAt: new Date("2026-02-01T11:00:00Z"),
    status: "COMPLETED",
    ...overrides,
  };
}

function makeLesson(overrides: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: "lesson-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    subject: "MATH",
    startsAt: new Date("2026-03-01T10:00:00Z"),
    status: "SCHEDULED",
    ...overrides,
  };
}

function defaultState(): MockState {
  return {
    grants: [makeGrant()],
    teachers: [makeTeacher()],
    children: [makeChild()],
    trialBookings: [makeTrial()],
    lessons: [],
    summaries: [
      {
        id: "summary-1",
        childId: "child-1",
        summary: {
          knowledgePoints: [
            { name: "分数加减", performance: "WEAK" },
            { name: "乘法口诀", performance: "STRONG" },
            { name: "应用题", performance: "WEAK" },
          ],
        },
        createdAt: new Date("2026-01-15"),
      },
    ],
    users: [{ id: "user-teacher-1" }, { id: "user-parent-1" }],
    notifications: [],
  };
}

const FIXED_NOW = new Date("2026-06-01T00:00:00Z");

// ─── 测试 ───────────────────────────────────────────────────

describe("GrantService.readStudentSummary", () => {
  it("returns only granted learning summary fields (不包含 parentPhone, rawAssessment)", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const summary = await service.readStudentSummary("teacher-1", "child-1");

    expect(summary.childId).toBe("child-1");
    expect(summary.displayName).toBe("小明");
    expect(summary.grade).toBe("三年级");
    expect(summary.learningGoals).toEqual(["逻辑思维", "计算准确"]);
    // weakKnowledgePoints 仅提取 performance=WEAK 的项
    expect(summary.weakKnowledgePoints).toEqual(["分数加减", "应用题"]);
    expect(summary.teachingPreferences).toEqual([]);

    // 严格排除敏感字段
    const json = JSON.stringify(summary);
    expect(json).not.toContain("parentPhone");
    expect(json).not.toContain("rawAssessment");
    expect(json).not.toContain("schoolName");
    expect(json).not.toContain("某某小学");
    expect(json).not.toContain("MBTI");
    expect(json).not.toContain("INTJ");
  });

  it("rejects other teacher accessing child summary (FORBIDDEN)", async () => {
    const state = defaultState();
    state.teachers.push(makeTeacher({ id: "teacher-2", userId: "user-teacher-2", displayName: "李老师" }));
    // teacher-2 没有 grant 也没有服务关系
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-2", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when grant is revoked", async () => {
    const state = defaultState();
    state.grants[0].revokedAt = new Date("2026-03-01");
    // findFirst where.revokedAt=null 不应返回已撤销的 grant
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when grant is expired", async () => {
    const state = defaultState();
    // grant 已过期
    state.grants[0].validUntil = new Date("2026-04-01");
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when teacher is PAUSED", async () => {
    const state = defaultState();
    state.teachers[0].serviceStatus = "PAUSED";
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when no service relationship exists", async () => {
    const state = defaultState();
    // 移除 trial 和 lesson，没有服务关系
    state.trialBookings = [];
    state.lessons = [];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when grant lacks LEARNING_NEEDS scope (only BASIC_PROFILE)", async () => {
    // 验证 scope 校验：只有 BASIC_PROFILE 时应被 LEARNING_NEEDS 校验拒绝
    const state = defaultState();
    state.grants[0].scopes = ["BASIC_PROFILE"];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("GrantService.revoke", () => {
  it("parent can revoke at any time", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const revoked = await service.revoke("parent-1", "grant-1");

    expect(revoked.revokedAt).toEqual(FIXED_NOW);
    expect(state.grants[0].revokedAt).toEqual(FIXED_NOW);
    // 通知已发出
    expect(state.notifications).toHaveLength(1);
    expect((state.notifications[0] as { body: { action: string } }).body.action).toBe(
      "GRANT_REVOKED",
    );

    // 撤销后立即失效：readStudentSummary 应被拒绝
    await expect(
      service.readStudentSummary("teacher-1", "child-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects revoke by non-owner parent (FORBIDDEN)", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(service.revoke("parent-other", "grant-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("rejects double revoke (RESOURCE_CONFLICT)", async () => {
    const state = defaultState();
    state.grants[0].revokedAt = new Date("2026-03-01");
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(service.revoke("parent-1", "grant-1")).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });

  it("rejects revoke when grant does not exist (NOT_FOUND)", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(service.revoke("parent-1", "grant-missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("GrantService.listByParent", () => {
  it("returns all grants for the parent", async () => {
    const state = defaultState();
    state.grants.push(
      makeGrant({
        id: "grant-2",
        teacherProfileId: "teacher-2",
        sourceBookingId: "booking-2",
        createdAt: new Date("2026-02-01"),
      }),
      makeGrant({
        id: "grant-3",
        parentProfileId: "parent-2",
        teacherProfileId: "teacher-3",
        sourceBookingId: "booking-3",
        createdAt: new Date("2026-03-01"),
      }),
    );
    state.teachers.push(
      makeTeacher({ id: "teacher-2", displayName: "李老师" }),
      makeTeacher({ id: "teacher-3", displayName: "王老师" }),
    );
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listByParent("parent-1");

    // 只返回 parent-1 的 grant（grant-1 和 grant-2），按 createdAt desc 排序
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toEqual(["grant-2", "grant-1"]);
    expect(result[0].teacherDisplayName).toBe("李老师");
    expect(result[1].teacherDisplayName).toBe("张老师");
    expect(result[0].scopes).toEqual(["BASIC_PROFILE", "LEARNING_NEEDS"]);
    expect(result[0].sourceBookingId).toBe("booking-2");
  });

  it("returns empty array when parent has no grants", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listByParent("parent-other");
    expect(result).toEqual([]);
  });
});

describe("GrantService.listByTeacher", () => {
  it("returns only own grants for the teacher", async () => {
    const state = defaultState();
    state.grants.push(
      makeGrant({
        id: "grant-2",
        teacherProfileId: "teacher-2",
        sourceBookingId: "booking-2",
        createdAt: new Date("2026-02-01"),
      }),
      makeGrant({
        id: "grant-3",
        parentProfileId: "parent-1",
        teacherProfileId: "teacher-1",
        sourceBookingId: "booking-3",
        createdAt: new Date("2026-03-01"),
      }),
    );
    state.teachers.push(makeTeacher({ id: "teacher-2", displayName: "李老师" }));
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listByTeacher("teacher-1");

    // teacher-1 收到 grant-1 和 grant-3，按 createdAt desc 排序
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toEqual(["grant-3", "grant-1"]);
    expect(result[0].sourceBookingId).toBe("booking-3");
    expect(result[1].sourceBookingId).toBe("booking-1");
  });

  it("returns empty array when teacher has no grants", async () => {
    const state = defaultState();
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const result = await service.listByTeacher("teacher-other");
    expect(result).toEqual([]);
  });
});

describe("GrantService.createForBooking", () => {
  it("creates grant with default scopes and validUntil = booking end + 7 days", async () => {
    const state = defaultState();
    state.grants = []; // 清空，避免 mock 的 nextGrantId 计算干扰
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const grant = await service.createForBooking({
      parentProfileId: "parent-1",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      bookingId: "booking-1",
    });

    expect(grant.parentProfileId).toBe("parent-1");
    expect(grant.childId).toBe("child-1");
    expect(grant.teacherProfileId).toBe("teacher-1");
    expect(grant.sourceBookingId).toBe("booking-1");
    expect(grant.scopes).toEqual(["BASIC_PROFILE", "LEARNING_NEEDS"]);
    expect(grant.revokedAt).toBeNull();
    // booking endsAt = 2026-02-01T11:00:00Z, +7 days = 2026-02-08T11:00:00Z
    expect(grant.validUntil).toEqual(new Date("2026-02-08T11:00:00Z"));
    expect(grant.validFrom).toEqual(FIXED_NOW);
  });

  it("honors explicit scopes and validUntil when provided", async () => {
    const state = defaultState();
    state.grants = [];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const customUntil = new Date("2026-09-01");
    const grant = await service.createForBooking({
      parentProfileId: "parent-1",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      bookingId: "booking-1",
      scopes: ["BASIC_PROFILE"],
      validUntil: customUntil,
    });

    expect(grant.scopes).toEqual(["BASIC_PROFILE"]);
    expect(grant.validUntil).toEqual(customUntil);
  });

  it("supports being called within a caller-provided transaction", async () => {
    const state = defaultState();
    state.grants = [];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const createdGrant: DataGrantRecord = {
      id: "grant-tx-1",
      parentProfileId: "parent-1",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      scopes: ["BASIC_PROFILE", "LEARNING_NEEDS"],
      validFrom: FIXED_NOW,
      validUntil: new Date("2026-02-08T11:00:00Z"),
      revokedAt: null,
      sourceBookingId: "booking-1",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };

    const tx: GrantTransactionClient = {
      dataGrant: {
        create: async ({ data }) => {
          state.grants.push({ ...createdGrant, ...data, id: "grant-tx-1" });
          return state.grants[state.grants.length - 1];
        },
      },
    };

    const grant = await service.createForBooking(
      {
        parentProfileId: "parent-1",
        childId: "child-1",
        teacherProfileId: "teacher-1",
        bookingId: "booking-1",
      },
      tx,
    );

    expect(grant.id).toBe("grant-tx-1");
    expect(grant.sourceBookingId).toBe("booking-1");
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0].id).toBe("grant-tx-1");
  });

  it("rejects when booking does not exist (NOT_FOUND)", async () => {
    const state = defaultState();
    state.grants = [];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    await expect(
      service.createForBooking({
        parentProfileId: "parent-1",
        childId: "child-1",
        teacherProfileId: "teacher-1",
        bookingId: "booking-missing",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("GrantService.listStudents", () => {
  it("returns students with upcoming lessons and completed trials", async () => {
    const state = defaultState();
    state.children.push(
      makeChild({ id: "child-2", name: "小红", parentProfileId: "parent-2" }),
    );
    state.teachers.push(makeTeacher({ id: "teacher-2" }));
    // child-1 有 upcoming lesson
    state.lessons.push(
      makeLesson({
        id: "lesson-1",
        childId: "child-1",
        subject: "MATH",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        status: "SCHEDULED",
      }),
    );
    // child-2 仅有 completed trial（无 upcoming lesson）
    state.trialBookings.push(
      makeTrial({
        id: "booking-2",
        childId: "child-2",
        subject: "ENGLISH",
        status: "COMPLETED",
      }),
    );
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const students = await service.listStudents("teacher-1");

    expect(students).toHaveLength(2);
    const byId = new Map(students.map((s) => [s.childId, s]));
    expect(byId.get("child-1")?.childDisplayName).toBe("小明");
    expect(byId.get("child-1")?.subject).toBe("MATH");
    expect(byId.get("child-1")?.nextLessonAt).toBe("2026-07-01T10:00:00.000Z");
    expect(byId.get("child-2")?.childDisplayName).toBe("小红");
    expect(byId.get("child-2")?.subject).toBe("ENGLISH");
    expect(byId.get("child-2")?.nextLessonAt).toBeNull();
  });

  it("excludes soft-deleted children", async () => {
    const state = defaultState();
    state.children[0].deletedAt = new Date("2026-05-01");
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const students = await service.listStudents("teacher-1");
    // child-1 软删，trial 不算入学生列表
    expect(students).toEqual([]);
  });

  it("returns empty array when teacher has no students", async () => {
    const state = defaultState();
    state.trialBookings = [];
    const service = new GrantService(createDatabase(state), () => FIXED_NOW);

    const students = await service.listStudents("teacher-1");
    expect(students).toEqual([]);
  });
});

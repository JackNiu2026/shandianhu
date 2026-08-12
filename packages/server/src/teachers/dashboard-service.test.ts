import { describe, expect, it } from "vitest";
import {
  DashboardService,
  type DashboardDatabase,
  type TeacherProfileRecord,
  type TrialBookingRecord,
  type LessonRecord,
  type TeacherFeedbackRecord,
  type ParentReviewRecord,
} from "./dashboard-service";
import type {
  Subject,
  TeachingMode,
  TeacherServiceStatus,
  TrialBookingStatus,
  LessonStatus,
} from "@prisma/client";

// ─── 测试辅助类型 ───────────────────────────────────────────

type ChildRecord = {
  id: string;
  name: string;
  deletedAt: Date | null;
};

interface MockState {
  teachers: TeacherProfileRecord[];
  bookings: TrialBookingRecord[];
  lessons: LessonRecord[];
  feedbacks: TeacherFeedbackRecord[];
  reviews: ParentReviewRecord[];
  children: ChildRecord[];
}

// ─── mock 数据库 ────────────────────────────────────────────

function createDatabase(state: MockState): DashboardDatabase {
  return {
    teacherProfile: {
      findUnique: async ({ where }) =>
        state.teachers.find((t) => t.id === where.id) ?? null,
    },
    trialBooking: {
      findMany: async ({ where, orderBy }) => {
        let items = state.bookings.filter(
          (b) =>
            b.teacherProfileId === where.teacherProfileId &&
            where.status.in.includes(b.status),
        );
        if (orderBy.createdAt === "asc") {
          items = items.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return items;
      },
    },
    lesson: {
      findMany: async ({ where, orderBy, take }) => {
        let items = state.lessons.filter(
          (l) =>
            l.teacherProfileId === where.teacherProfileId &&
            where.status.in.includes(l.status),
        );
        if (orderBy.startsAt === "asc") {
          items = items.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        }
        if (take !== undefined) items = items.slice(0, take);
        return items;
      },
    },
    teacherFeedback: {
      findMany: async ({ where }) =>
        state.feedbacks.filter(
          (f) => where.lessonId.in.includes(f.lessonId) && f.isCurrent === where.isCurrent,
        ),
    },
    parentReview: {
      findMany: async ({ where }) =>
        state.reviews.filter((r) => where.lessonId.in.includes(r.lessonId)),
    },
    child: {
      findUnique: async ({ where }) =>
        state.children.find((c) => c.id === where.id) ?? null,
    },
  };
}

// ─── 工厂函数 ───────────────────────────────────────────────

function makeTeacher(
  overrides: Partial<TeacherProfileRecord> = {},
): TeacherProfileRecord {
  return {
    id: "teacher-1",
    userId: "user-teacher",
    displayName: "张老师",
    serviceStatus: "ACTIVE" as TeacherServiceStatus,
    ...overrides,
  };
}

function makeBooking(
  overrides: Partial<TrialBookingRecord> = {},
): TrialBookingRecord {
  return {
    id: "booking-1",
    idempotencyKey: "idem-1",
    parentProfileId: "parent-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    subject: "MATH" as Subject,
    startsAt: new Date("2026-09-01T10:00:00Z"),
    endsAt: new Date("2026-09-01T11:00:00Z"),
    status: "REQUESTED" as TrialBookingStatus,
    mode: "ONLINE" as TeachingMode,
    parentNote: null,
    version: 0,
    createdAt: new Date("2026-08-01"),
    ...overrides,
  };
}

function makeLesson(
  overrides: Partial<LessonRecord> = {},
): LessonRecord {
  return {
    id: "lesson-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    subject: "MATH" as Subject,
    startsAt: new Date("2026-09-01T10:00:00Z"),
    endsAt: new Date("2026-09-01T11:00:00Z"),
    status: "SCHEDULED" as LessonStatus,
    mode: "ONLINE" as TeachingMode,
    completedAt: null,
    ...overrides,
  };
}

function makeFeedback(
  overrides: Partial<TeacherFeedbackRecord> = {},
): TeacherFeedbackRecord {
  return {
    id: "feedback-1",
    lessonId: "lesson-1",
    isCurrent: true,
    ...overrides,
  };
}

function makeReview(
  overrides: Partial<ParentReviewRecord> = {},
): ParentReviewRecord {
  return {
    id: "review-1",
    lessonId: "lesson-1",
    ...overrides,
  };
}

function makeChild(overrides: Partial<ChildRecord> = {}): ChildRecord {
  return {
    id: "child-1",
    name: "小明",
    deletedAt: null,
    ...overrides,
  };
}

// ─── 测试 ───────────────────────────────────────────────────

describe("DashboardService", () => {
  it("returns only the current teacher's actionable items", async () => {
    const state: MockState = {
      teachers: [
        makeTeacher({ id: "teacher-1", displayName: "张老师" }),
        makeTeacher({ id: "teacher-2", displayName: "李老师" }),
      ],
      bookings: [
        makeBooking({
          id: "booking-1",
          teacherProfileId: "teacher-1",
          status: "REQUESTED",
          createdAt: new Date("2026-08-01"),
        }),
        makeBooking({
          id: "booking-2",
          teacherProfileId: "teacher-2",
          status: "REQUESTED",
          createdAt: new Date("2026-08-02"),
        }),
      ],
      lessons: [
        makeLesson({
          id: "lesson-1",
          teacherProfileId: "teacher-1",
          status: "SCHEDULED",
        }),
        makeLesson({
          id: "lesson-2",
          teacherProfileId: "teacher-2",
          status: "SCHEDULED",
        }),
      ],
      feedbacks: [],
      reviews: [],
      children: [makeChild({ id: "child-1", name: "小明" })],
    };
    const service = new DashboardService(createDatabase(state));

    const dashboard = await service.load("teacher-1");

    // 只返回 teacher-1 的数据
    expect(dashboard.pendingTrials).toHaveLength(1);
    expect(dashboard.pendingTrials[0].id).toBe("booking-1");
    expect(dashboard.upcomingLessons).toHaveLength(1);
    expect(dashboard.upcomingLessons[0].id).toBe("lesson-1");
    // teacherDisplayName 由当前老师填充
    expect(dashboard.pendingTrials[0].teacherDisplayName).toBe("张老师");
    expect(dashboard.upcomingLessons[0].teacherDisplayName).toBe("张老师");
    expect(dashboard.serviceStatus).toBe("ACTIVE");
  });

  it("pendingTrials only includes REQUESTED/ACCEPTED/RESCHEDULE_PROPOSED", async () => {
    const state: MockState = {
      teachers: [makeTeacher()],
      bookings: [
        makeBooking({ id: "b-requested", status: "REQUESTED", createdAt: new Date("2026-08-01") }),
        makeBooking({ id: "b-accepted", status: "ACCEPTED", createdAt: new Date("2026-08-02") }),
        makeBooking({
          id: "b-reschedule",
          status: "RESCHEDULE_PROPOSED",
          createdAt: new Date("2026-08-03"),
        }),
        makeBooking({ id: "b-rejected", status: "REJECTED", createdAt: new Date("2026-08-04") }),
        makeBooking({
          id: "b-confirmed",
          status: "PARENT_CONFIRMED",
          createdAt: new Date("2026-08-05"),
        }),
        makeBooking({ id: "b-ready", status: "READY", createdAt: new Date("2026-08-06") }),
        makeBooking({ id: "b-completed", status: "COMPLETED", createdAt: new Date("2026-08-07") }),
        makeBooking({ id: "b-cancelled", status: "CANCELLED", createdAt: new Date("2026-08-08") }),
      ],
      lessons: [],
      feedbacks: [],
      reviews: [],
      children: [],
    };
    const service = new DashboardService(createDatabase(state));

    const dashboard = await service.load("teacher-1");

    const statuses = dashboard.pendingTrials.map((t) => t.status);
    expect(statuses).toEqual(
      expect.arrayContaining(["REQUESTED", "ACCEPTED", "RESCHEDULE_PROPOSED"]),
    );
    expect(dashboard.pendingTrials).toHaveLength(3);
    // 按 createdAt 升序
    expect(dashboard.pendingTrials.map((t) => t.id)).toEqual([
      "b-requested",
      "b-accepted",
      "b-reschedule",
    ]);
  });

  it("lessonsAwaitingFeedback only includes COMPLETED without current feedback", async () => {
    const state: MockState = {
      teachers: [makeTeacher()],
      bookings: [],
      lessons: [
        // 已完成、有 current feedback → 不应出现
        makeLesson({
          id: "lesson-completed-with-feedback",
          status: "COMPLETED",
          completedAt: new Date("2026-08-10"),
          startsAt: new Date("2026-08-10T10:00:00Z"),
        }),
        // 已完成、无 current feedback → 应出现
        makeLesson({
          id: "lesson-completed-no-feedback",
          status: "COMPLETED",
          completedAt: new Date("2026-08-11"),
          startsAt: new Date("2026-08-11T10:00:00Z"),
        }),
        // 已完成、有非 current feedback（被纠正）→ 应出现（无 current feedback）
        makeLesson({
          id: "lesson-completed-superseded-feedback",
          status: "COMPLETED",
          completedAt: new Date("2026-08-12"),
          startsAt: new Date("2026-08-12T10:00:00Z"),
        }),
        // 未完成 → 不应出现
        makeLesson({
          id: "lesson-scheduled",
          status: "SCHEDULED",
          startsAt: new Date("2026-09-01T10:00:00Z"),
        }),
        makeLesson({
          id: "lesson-in-progress",
          status: "IN_PROGRESS",
          startsAt: new Date("2026-09-02T10:00:00Z"),
        }),
      ],
      feedbacks: [
        makeFeedback({
          id: "fb-current",
          lessonId: "lesson-completed-with-feedback",
          isCurrent: true,
        }),
        makeFeedback({
          id: "fb-superseded",
          lessonId: "lesson-completed-superseded-feedback",
          isCurrent: false,
        }),
      ],
      reviews: [],
      children: [],
    };
    const service = new DashboardService(createDatabase(state));

    const dashboard = await service.load("teacher-1");

    const ids = dashboard.lessonsAwaitingFeedback.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "lesson-completed-no-feedback",
        "lesson-completed-superseded-feedback",
      ]),
    );
    expect(dashboard.lessonsAwaitingFeedback).toHaveLength(2);
    // 待反馈课程的 hasFeedback 必为 false
    for (const lesson of dashboard.lessonsAwaitingFeedback) {
      expect(lesson.hasFeedback).toBe(false);
      expect(lesson.status).toBe("COMPLETED");
    }
  });

  it("activeStudents deduplicated by childId", async () => {
    const state: MockState = {
      teachers: [makeTeacher()],
      bookings: [],
      lessons: [
        // 同一个孩子 child-1 有三节未来课程
        makeLesson({
          id: "lesson-a",
          childId: "child-1",
          subject: "MATH",
          status: "SCHEDULED",
          startsAt: new Date("2026-09-05T10:00:00Z"),
        }),
        makeLesson({
          id: "lesson-b",
          childId: "child-1",
          subject: "ENGLISH",
          status: "SCHEDULED",
          startsAt: new Date("2026-09-03T10:00:00Z"), // 更早
        }),
        makeLesson({
          id: "lesson-c",
          childId: "child-1",
          subject: "PHYSICS",
          status: "IN_PROGRESS",
          startsAt: new Date("2026-09-10T10:00:00Z"),
        }),
        // 另一个孩子 child-2
        makeLesson({
          id: "lesson-d",
          childId: "child-2",
          subject: "CHINESE",
          status: "SCHEDULED",
          startsAt: new Date("2026-09-04T10:00:00Z"),
        }),
      ],
      feedbacks: [],
      reviews: [],
      children: [
        makeChild({ id: "child-1", name: "小明" }),
        makeChild({ id: "child-2", name: "小红" }),
      ],
    };
    const service = new DashboardService(createDatabase(state));

    const dashboard = await service.load("teacher-1");

    // child-1 去重后只出现一次
    const childIds = dashboard.activeStudents.map((s) => s.childId);
    const uniqueChildIds = new Set(childIds);
    expect(uniqueChildIds.size).toBe(childIds.length);
    expect(childIds).toEqual(expect.arrayContaining(["child-1", "child-2"]));
    expect(dashboard.activeStudents).toHaveLength(2);

    // child-1 取最早一节课的科目和时间（lesson-b，ENGLISH，2026-09-03）
    const student1 = dashboard.activeStudents.find((s) => s.childId === "child-1");
    expect(student1).toBeDefined();
    expect(student1!.childDisplayName).toBe("小明");
    expect(student1!.subject).toBe("ENGLISH");
    expect(student1!.nextLessonAt).toBe(new Date("2026-09-03T10:00:00Z").toISOString());
  });

  it("throws NOT_FOUND when teacher profile does not exist", async () => {
    const state: MockState = {
      teachers: [],
      bookings: [],
      lessons: [],
      feedbacks: [],
      reviews: [],
      children: [],
    };
    const service = new DashboardService(createDatabase(state));

    await expect(service.load("teacher-missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  ReviewService,
  type ReviewDatabase,
  type ParentReviewRecord,
  type ReviewLessonRecord,
} from "./review-service";
import type { CreateReviewInput } from "./review-service";

// ─── 测试辅助类型 ───────────────────────────────────────────

type ParentProfileRecord = {
  id: string;
  userId: string;
  displayName: string | null;
};

type ChildRecord = {
  id: string;
  parentProfileId: string;
};

type TeacherProfileRecord = {
  id: string;
  userId: string;
};

type NotificationRecord = {
  userId: string;
  type: string;
  dedupeKey: string;
};

interface MockState {
  lessons: ReviewLessonRecord[];
  reviews: ParentReviewRecord[];
  parents: ParentProfileRecord[];
  children: ChildRecord[];
  teachers: TeacherProfileRecord[];
  notifications: NotificationRecord[];
}

let nextReviewId = 1;

function resetIds(): void {
  nextReviewId = 1;
}

function defaultState(): MockState {
  return {
    lessons: [
      {
        id: "lesson-1",
        childId: "child-1",
        teacherProfileId: "teacher-1",
        status: "COMPLETED",
      },
    ],
    reviews: [],
    parents: [
      { id: "parent-1", userId: "user-parent", displayName: "张三" },
    ],
    children: [
      { id: "child-1", parentProfileId: "parent-1" },
    ],
    teachers: [
      { id: "teacher-1", userId: "user-teacher" },
    ],
    notifications: [],
  };
}

// ─── mock 数据库 ────────────────────────────────────────────

function createDatabase(state: MockState): ReviewDatabase {
  const db: ReviewDatabase = {
    lesson: {
      findUnique: async ({ where }) =>
        state.lessons.find((l) => l.id === where.id) ?? null,
    },
    parentReview: {
      findUnique: async ({ where }) =>
        state.reviews.find((r) => r.lessonId === where.lessonId) ?? null,
      findMany: async ({ where, orderBy, take }) => {
        let items = state.reviews.slice();
        if (where.teacherProfileId) {
          items = items.filter((r) => r.teacherProfileId === where.teacherProfileId);
        }
        if (where.parentProfileId) {
          items = items.filter((r) => r.parentProfileId === where.parentProfileId);
        }
        if (orderBy.createdAt === "desc") {
          items = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (take !== undefined) {
          items = items.slice(0, take);
        }
        return items;
      },
      create: async ({ data }) => {
        // 检查唯一约束：lessonId
        const existing = state.reviews.find((r) => r.lessonId === data.lessonId);
        if (existing) {
          throw Object.assign(new Error("Unique constraint"), {
            code: "P2002",
            meta: { target: ["lessonId"] },
          });
        }
        const now = new Date();
        const review: ParentReviewRecord = {
          id: `review-${nextReviewId++}`,
          ...data,
          createdAt: now,
          updatedAt: now,
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
      upsert: async ({ where, create }) => {
        const existing = state.notifications.find((n) => n.dedupeKey === where.dedupeKey);
        if (existing) return {};
        state.notifications.push({
          userId: create.userId,
          type: create.type,
          dedupeKey: create.dedupeKey,
        });
        return {};
      },
    },
  };
  return db;
}

function createService(state: MockState): ReviewService {
  resetIds();
  const database = createDatabase(state);
  return new ReviewService(database);
}

function defaultInput(overrides: Partial<CreateReviewInput> = {}): CreateReviewInput {
  return {
    rating: 5,
    content: "老师讲课非常认真，孩子进步很大，感谢老师的耐心指导！",
    ...overrides,
  };
}

// ─── create 测试 ──────────────────────────────────────────

describe("ReviewService.create", () => {
  it("creates a review for a completed lesson owned by the parent", async () => {
    const state = defaultState();
    const service = createService(state);

    const result = await service.create("parent-1", "lesson-1", defaultInput());

    expect(result.rating).toBe(5);
    expect(result.lessonId).toBe("lesson-1");
    expect(state.reviews).toHaveLength(1);
  });

  it("rejects reviews without a completed lesson owned by the parent (FORBIDDEN)", async () => {
    const state = defaultState();
    // 添加另一个家长和课程
    state.parents.push({ id: "parent-2", userId: "user-parent-2", displayName: "李四" });
    state.children.push({ id: "child-2", parentProfileId: "parent-2" });
    state.lessons.push({
      id: "lesson-2",
      childId: "child-2",
      teacherProfileId: "teacher-1",
      status: "COMPLETED",
    });
    const service = createService(state);

    // parent-1 试图评价 parent-2 的课程
    await expect(
      service.create("parent-1", "lesson-2", defaultInput()),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects review on scheduled lesson (RESOURCE_CONFLICT)", async () => {
    const state = defaultState();
    state.lessons[0].status = "SCHEDULED";
    const service = createService(state);

    await expect(
      service.create("parent-1", "lesson-1", defaultInput()),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("rejects second review for same lesson (RESOURCE_CONFLICT)", async () => {
    const state = defaultState();
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());

    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ rating: 3 })),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("rating must be 1-5", async () => {
    const state = defaultState();
    const service = createService(state);

    // rating = 0
    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ rating: 0 })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // rating = 6
    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ rating: 6 })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // rating = 3.5（非整数）
    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ rating: 3.5 })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("content must be 10-1000 chars", async () => {
    const state = defaultState();
    const service = createService(state);

    // 内容过短（< 10 字符）
    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ content: "太短了" })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // 内容过长（> 1000 字符）
    const longContent = "a".repeat(1001);
    await expect(
      service.create("parent-1", "lesson-1", defaultInput({ content: longContent })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("author derived from session (not from client input)", async () => {
    const state = defaultState();
    // parentProfile.displayName = "张三"
    const service = createService(state);

    const result = await service.create("parent-1", "lesson-1", defaultInput());

    // authorDisplayName 从 parentProfile.displayName 脱敏推导，不从 input 获取
    // "张三" → "张家长"
    expect(result.authorDisplayName).toBe("张家长");
  });

  it("authorDisplayName defaults to '家长' when parent has no displayName", async () => {
    const state = defaultState();
    state.parents[0].displayName = null;
    const service = createService(state);

    const result = await service.create("parent-1", "lesson-1", defaultInput());

    expect(result.authorDisplayName).toBe("家长");
  });

  it("sends notification to teacher on create", async () => {
    const state = defaultState();
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].userId).toBe("user-teacher");
    expect(state.notifications[0].type).toBe("REVIEW_RECEIVED");
  });
});

// ─── getByLesson 测试 ─────────────────────────────────────

describe("ReviewService.getByLesson", () => {
  it("returns review for lesson", async () => {
    const state = defaultState();
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());
    const result = await service.getByLesson("lesson-1");

    expect(result).not.toBeNull();
    expect(result!.lessonId).toBe("lesson-1");
  });

  it("returns null when no review exists", async () => {
    const state = defaultState();
    const service = createService(state);

    const result = await service.getByLesson("lesson-1");

    expect(result).toBeNull();
  });
});

// ─── listByTeacher 测试 ───────────────────────────────────

describe("ReviewService.listByTeacher", () => {
  it("returns public reviews for teacher", async () => {
    const state = defaultState();
    // 添加第二个课程
    state.lessons.push({
      id: "lesson-2",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      status: "COMPLETED",
    });
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());
    await service.create("parent-1", "lesson-2", defaultInput({ rating: 4 }));

    const reviews = await service.listByTeacher("teacher-1");

    expect(reviews).toHaveLength(2);
    // 公开 DTO 包含 lessonMonth
    expect(reviews[0].lessonMonth).toBeDefined();
  });

  it("respects limit parameter", async () => {
    const state = defaultState();
    state.lessons.push({
      id: "lesson-2",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      status: "COMPLETED",
    });
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());
    await service.create("parent-1", "lesson-2", defaultInput());

    const reviews = await service.listByTeacher("teacher-1", 1);

    expect(reviews).toHaveLength(1);
  });
});

// ─── listByParent 测试 ────────────────────────────────────

describe("ReviewService.listByParent", () => {
  it("returns review history for parent", async () => {
    const state = defaultState();
    state.lessons.push({
      id: "lesson-2",
      childId: "child-1",
      teacherProfileId: "teacher-1",
      status: "COMPLETED",
    });
    const service = createService(state);

    await service.create("parent-1", "lesson-1", defaultInput());
    await service.create("parent-1", "lesson-2", defaultInput({ rating: 3 }));

    const reviews = await service.listByParent("parent-1");

    expect(reviews).toHaveLength(2);
    expect(reviews[0].lessonId).toBeDefined();
  });
});

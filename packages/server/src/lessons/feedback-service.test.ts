import { describe, expect, it } from "vitest";
import {
  FeedbackService,
  type FeedbackDatabase,
  type TeacherFeedbackRecord,
  type LearningEvidenceRecord,
  type LessonRecord,
  type FeedbackJobEnqueuer,
} from "./feedback-service";
import type { TeacherFeedbackInput } from "./feedback-schema";

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

type NotificationRecord = {
  userId: string;
  type: string;
  dedupeKey: string;
};

interface MockState {
  lessons: LessonRecord[];
  feedbacks: TeacherFeedbackRecord[];
  evidences: LearningEvidenceRecord[];
  parents: ParentProfileRecord[];
  children: ChildRecord[];
  notifications: NotificationRecord[];
}

let nextFeedbackId = 1;
let nextEvidenceId = 1;

function resetIds(): void {
  nextFeedbackId = 1;
  nextEvidenceId = 1;
}

function defaultState(): MockState {
  return {
    lessons: [
      {
        id: "lesson-1",
        childId: "child-1",
        teacherProfileId: "teacher-1",
        status: "COMPLETED",
        completedAt: new Date("2026-08-10T03:00:00Z"),
      },
    ],
    feedbacks: [],
    evidences: [],
    parents: [
      { id: "parent-1", userId: "user-parent", displayName: "张三" },
    ],
    children: [
      { id: "child-1", parentProfileId: "parent-1" },
    ],
    notifications: [],
  };
}

// ─── mock 数据库 ────────────────────────────────────────────

function createDatabase(state: MockState): FeedbackDatabase {
  const db: FeedbackDatabase = {
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
          id: `feedback-${nextFeedbackId++}`,
          ...data,
          createdAt: new Date(),
        };
        state.feedbacks.push(feedback);
        return feedback;
      },
      update: async ({ where, data }) => {
        const feedback = state.feedbacks.find((f) => f.id === where.id);
        if (!feedback) throw new Error("feedback not found");
        if (data.isCurrent !== undefined) feedback.isCurrent = data.isCurrent;
        return feedback;
      },
    },
    learningEvidence: {
      findFirst: async ({ where }) =>
        state.evidences.find(
          (e) =>
            e.childId === where.childId &&
            e.source === where.source &&
            e.sourceId === where.sourceId,
        ) ?? null,
      create: async ({ data }) => {
        // 检查唯一约束：(childId, source, sourceId)
        const existing = state.evidences.find(
          (e) =>
            e.childId === data.childId &&
            e.source === data.source &&
            e.sourceId === data.sourceId,
        );
        if (existing) {
          throw Object.assign(new Error("Unique constraint"), {
            code: "P2002",
            meta: { target: ["childId", "source", "sourceId"] },
          });
        }
        const evidence: LearningEvidenceRecord = {
          id: `evidence-${nextEvidenceId++}`,
          ...data,
          revokedAt: null,
          createdAt: new Date(),
        };
        state.evidences.push(evidence);
        return evidence;
      },
      update: async ({ where, data }) => {
        const evidence = state.evidences.find((e) => e.id === where.id);
        if (!evidence) throw new Error("evidence not found");
        if (data.revokedAt !== undefined) evidence.revokedAt = data.revokedAt;
        return evidence;
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
    $transaction: async <T>(callback: (tx: FeedbackDatabase) => Promise<T>): Promise<T> =>
      callback(db),
  };
  return db;
}

function createJobEnqueuer(): FeedbackJobEnqueuer & { calls: Array<{ type: string; dedupeKey: string }> } {
  const calls: Array<{ type: string; dedupeKey: string }> = [];
  return {
    calls,
    enqueue: async (type, dedupeKey) => {
      calls.push({ type, dedupeKey });
      return {};
    },
  };
}

function createService(
  state: MockState,
  options: { clock?: () => Date } = {},
): { service: FeedbackService; jobEnqueuer: FeedbackJobEnqueuer & { calls: Array<{ type: string; dedupeKey: string }> } } {
  resetIds();
  const database = createDatabase(state);
  const jobEnqueuer = createJobEnqueuer();
  return {
    service: new FeedbackService(database, jobEnqueuer, options.clock ?? (() => new Date())),
    jobEnqueuer,
  };
}

function defaultInput(overrides: Partial<TeacherFeedbackInput> = {}): TeacherFeedbackInput {
  return {
    lessonContent: ["二次函数图像性质"],
    performance: "STEADY",
    difficulties: ["配方法不熟练"],
    suggestions: ["多做配方法练习题"],
    privateTeacherNote: "该生基础较弱，需要耐心引导",
    ...overrides,
  };
}

// ─── submit 测试 ──────────────────────────────────────────

describe("FeedbackService.submit", () => {
  it("creates one signed evidence record for one lesson feedback", async () => {
    const state = defaultState();
    const { service } = createService(state);

    const result = await service.submit(
      "teacher-1",
      "lesson-1",
      "op-key-1",
      defaultInput(),
    );

    expect(result.sequence).toBe(1);
    expect(result.isCurrent).toBe(true);
    expect(state.feedbacks).toHaveLength(1);
    // 恰好创建一条 evidence
    expect(state.evidences).toHaveLength(1);
    expect(state.evidences[0].source).toBe("TEACHER_FEEDBACK");
    expect(state.evidences[0].sourceId).toBe("op-key-1");
  });

  it("idempotent submit returns same record", async () => {
    const state = defaultState();
    const { service } = createService(state);

    const first = await service.submit(
      "teacher-1",
      "lesson-1",
      "op-key-1",
      defaultInput(),
    );
    const second = await service.submit(
      "teacher-1",
      "lesson-1",
      "op-key-1",
      defaultInput(),
    );

    expect(second.id).toBe(first.id);
    expect(second.sequence).toBe(first.sequence);
    // 仍然只有一条 feedback 和一条 evidence
    expect(state.feedbacks).toHaveLength(1);
    expect(state.evidences).toHaveLength(1);
  });

  it("revision creates new version and marks old as non-current", async () => {
    const state = defaultState();
    const { service } = createService(state);

    const first = await service.submit(
      "teacher-1",
      "lesson-1",
      "op-key-1",
      defaultInput(),
    );
    const second = await service.submit(
      "teacher-1",
      "lesson-1",
      "op-key-2",
      defaultInput({ performance: "STRONG" }),
      "修正评价等级",
    );

    expect(second.sequence).toBe(2);
    expect(second.isCurrent).toBe(true);
    expect(second.supersedesId ?? "").toBe(first.id);

    // 旧版本 isCurrent=false
    const oldFeedback = state.feedbacks.find((f) => f.id === first.id);
    expect(oldFeedback!.isCurrent).toBe(false);

    // 两条 feedback，两条 evidence
    expect(state.feedbacks).toHaveLength(2);
    expect(state.evidences).toHaveLength(2);
  });

  it("rejects feedback from non-owning teacher", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await expect(
      service.submit("teacher-other", "lesson-1", "op-key-1", defaultInput()),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects feedback on non-completed lesson", async () => {
    const state = defaultState();
    state.lessons[0].status = "SCHEDULED";
    const { service } = createService(state);

    await expect(
      service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput()),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("privateTeacherNote not in evidence", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput({
      privateTeacherNote: "私密备注内容",
    }));

    const evidence = state.evidences[0];
    const payload = evidence.payload as Record<string, unknown>;
    // evidence payload 不包含 privateTeacherNote
    expect(payload.privateTeacherNote).toBeUndefined();
    // 但包含公开字段
    expect(payload.lessonContent).toBeDefined();
    expect(payload.performance).toBeDefined();
    expect(payload.suggestions).toBeDefined();
  });

  it("rejects revision without correctionReason", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput());

    await expect(
      service.submit("teacher-1", "lesson-1", "op-key-2", defaultInput()),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("sends notification to parent on submit", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput());

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].userId).toBe("user-parent");
    expect(state.notifications[0].type).toBe("FEEDBACK_RECEIVED");
  });

  it("enqueues PROFILE_GENERATION and REPORT_GENERATION jobs after transaction", async () => {
    const state = defaultState();
    const { service, jobEnqueuer } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput());

    expect(jobEnqueuer.calls).toHaveLength(2);
    expect(jobEnqueuer.calls[0].type).toBe("PROFILE_GENERATION");
    expect(jobEnqueuer.calls[1].type).toBe("REPORT_GENERATION");
  });
});

// ─── getByLesson 测试 ─────────────────────────────────────

describe("FeedbackService.getByLesson", () => {
  it("teacher can see full feedback including privateTeacherNote", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput({
      privateTeacherNote: "私密备注",
    }));

    const result = await service.getByLesson("lesson-1", "teacher-1");

    expect(result.privateTeacherNote).toBe("私密备注");
  });

  it("parent cannot see privateTeacherNote", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput({
      privateTeacherNote: "私密备注",
    }));

    const result = await service.getByLesson("lesson-1", "parent-1");

    // 家长看不到 privateTeacherNote
    expect(result.privateTeacherNote).toBeNull();
    // 但能看到公开字段
    expect(result.lessonContent).toEqual(["二次函数图像性质"]);
  });

  it("rejects when viewer is neither teacher nor parent", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput());

    await expect(
      service.getByLesson("lesson-1", "parent-other"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when lesson not found", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await expect(
      service.getByLesson("lesson-nonexistent", "teacher-1"),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

// ─── listByLesson 测试 ────────────────────────────────────

describe("FeedbackService.listByLesson", () => {
  it("returns all versions sorted by sequence desc", async () => {
    const state = defaultState();
    const { service } = createService(state);

    await service.submit("teacher-1", "lesson-1", "op-key-1", defaultInput());
    await service.submit("teacher-1", "lesson-1", "op-key-2", defaultInput(), "修正");

    const versions = await service.listByLesson("lesson-1");

    expect(versions).toHaveLength(2);
    expect(versions[0].sequence).toBe(2);
    expect(versions[1].sequence).toBe(1);
    // listByLesson 包含 privateTeacherNote（仅老师可用）
    expect(versions[0].privateTeacherNote).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  TrialService,
  type TrialDatabase,
  type TrialBookingRecord,
  type BookingChangeRecord,
  type LessonRecord,
} from "./trial-service";
import { ConflictService, type ConflictDatabase, type ReservationRecord } from "../scheduling/conflict-service";
import type { SlotService, AvailabilitySlot } from "../scheduling/slot-service";
import type {
  Subject,
  TeachingMode,
  DataGrantScope,
  TeacherServiceStatus,
} from "@prisma/client";

// ─── 测试辅助 ───────────────────────────────────────────────

type ParentRecord = {
  id: string;
  userId: string;
  children: Array<{ id: string }>;
};

type TeacherRecord = {
  id: string;
  userId: string;
  serviceStatus: TeacherServiceStatus;
};

type MockState = {
  parents: ParentRecord[];
  teachers: TeacherRecord[];
  bookings: TrialBookingRecord[];
  changes: BookingChangeRecord[];
  lessons: LessonRecord[];
  grants: Array<{
    parentProfileId: string;
    childId: string;
    teacherProfileId: string;
    scopes: DataGrantScope[];
    sourceBookingId: string;
  }>;
  notifications: Array<{ userId: string; type: string; dedupeKey: string }>;
  reservations: ReservationRecord[];
};

function defaultState(): MockState {
  return {
    parents: [
      { id: "parent-1", userId: "user-parent", children: [{ id: "child-1" }] },
    ],
    teachers: [
      { id: "teacher-1", userId: "user-teacher", serviceStatus: "ACTIVE" },
    ],
    bookings: [],
    changes: [],
    lessons: [],
    grants: [],
    notifications: [],
    reservations: [],
  };
}

let nextBookingId = 1;
let nextChangeId = 1;
let nextLessonId = 1;
let nextReservationId = 1;

function resetIds(): void {
  nextBookingId = 1;
  nextChangeId = 1;
  nextLessonId = 1;
  nextReservationId = 1;
}

/**
 * 创建组合数据库 mock，同时实现 TrialDatabase 和 ConflictDatabase。
 * TrialService 在事务内把 tx 传给 ConflictService，因此 tx 必须同时
 * 拥有 trialBooking 和 scheduleReservation。
 */
function createDatabase(state: MockState): TrialDatabase & ConflictDatabase {
  const db: TrialDatabase & ConflictDatabase = {
    parentProfile: {
      findUnique: async ({ where, include }) => {
        const parent = state.parents.find((p) => p.id === where.id);
        if (!parent) return null;
        if (include?.children) {
          const children = parent.children.filter((c) =>
            include.children!.where.id === c.id,
          );
          return { ...parent, children };
        }
        return parent;
      },
    },
    teacherProfile: {
      findUnique: async ({ where }) =>
        state.teachers.find((t) => t.id === where.id) ?? null,
    },
    trialBooking: {
      findUnique: async ({ where }) =>
        state.bookings.find((b) => b.id === where.id) ?? null,
      findFirst: async ({ where }) =>
        state.bookings.find(
          (b) =>
            b.parentProfileId === where.parentProfileId &&
            b.idempotencyKey === where.idempotencyKey,
        ) ?? null,
      findMany: async ({ where, orderBy }) => {
        let items = state.bookings.filter((b) => {
          if (where.parentProfileId && b.parentProfileId !== where.parentProfileId) return false;
          if (where.teacherProfileId && b.teacherProfileId !== where.teacherProfileId) return false;
          if (where.status && b.status !== where.status) return false;
          return true;
        });
        if (orderBy.createdAt === "desc") {
          items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items;
      },
      create: async ({ data }) => {
        // 检查幂等唯一约束
        const existing = state.bookings.find(
          (b) =>
            b.parentProfileId === data.parentProfileId &&
            b.idempotencyKey === data.idempotencyKey,
        );
        if (existing) {
          throw Object.assign(new Error("Unique constraint"), {
            code: "P2002",
            meta: { target: ["parentProfileId", "idempotencyKey"] },
          });
        }
        const booking: TrialBookingRecord = {
          id: `booking-${nextBookingId++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.bookings.push(booking);
        return booking;
      },
      update: async ({ where, data }) => {
        const booking = state.bookings.find((b) => b.id === where.id);
        if (!booking) return null;
        // 乐观锁：version 必须匹配
        if (booking.version !== where.version) return null;
        if (data.status !== undefined) booking.status = data.status;
        if (data.startsAt !== undefined) booking.startsAt = data.startsAt;
        if (data.endsAt !== undefined) booking.endsAt = data.endsAt;
        if (data.version && typeof data.version === "object" && "increment" in data.version) {
          booking.version += data.version.increment;
        }
        booking.updatedAt = new Date();
        return booking;
      },
    },
    bookingChange: {
      create: async ({ data }) => {
        const change: BookingChangeRecord = {
          id: `change-${nextChangeId++}`,
          ...data,
          createdAt: new Date(),
        };
        state.changes.push(change);
        return change;
      },
      findMany: async ({ where, orderBy }) => {
        let items = state.changes.filter((c) => c.bookingId === where.bookingId);
        if (orderBy.createdAt === "desc") {
          items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items;
      },
    },
    lesson: {
      create: async ({ data }) => {
        const lesson: LessonRecord = {
          id: `lesson-${nextLessonId++}`,
          ...data,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.lessons.push(lesson);
        return lesson;
      },
      update: async ({ where, data }) => {
        const lesson = state.lessons.find((l) => l.id === where.id);
        if (!lesson) throw new Error("lesson not found");
        if (data.status !== undefined) lesson.status = data.status;
        if (data.completedAt !== undefined) lesson.completedAt = data.completedAt;
        lesson.updatedAt = new Date();
        return lesson;
      },
      findUnique: async ({ where }) =>
        state.lessons.find((l) => l.trialBookingId === where.trialBookingId) ?? null,
    },
    dataGrant: {
      create: async ({ data }) => {
        state.grants.push({
          parentProfileId: data.parentProfileId,
          childId: data.childId,
          teacherProfileId: data.teacherProfileId,
          scopes: data.scopes,
          sourceBookingId: data.sourceBookingId,
        });
        return {};
      },
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
    scheduleReservation: {
      create: async ({ data }) => {
        // 检查排他约束：同一老师 active=true 的时段不可重叠
        const overlapping = state.reservations.find(
          (r) =>
            r.teacherProfileId === data.teacherProfileId &&
            r.active &&
            r.startsAt < data.endsAt &&
            data.startsAt < r.endsAt,
        );
        if (overlapping) {
          throw Object.assign(new Error("exclusion constraint"), {
            code: "23P10",
            message: "ScheduleReservation_no_overlap",
          });
        }
        // 检查唯一约束：sourceType + sourceId
        const duplicate = state.reservations.find(
          (r) => r.sourceType === data.sourceType && r.sourceId === data.sourceId,
        );
        if (duplicate) {
          throw Object.assign(new Error("Unique constraint"), {
            code: "P2002",
            meta: { target: ["sourceType", "sourceId"] },
          });
        }
        const reservation: ReservationRecord = {
          id: `res-${nextReservationId++}`,
          teacherProfileId: data.teacherProfileId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          active: data.active ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.reservations.push(reservation);
        return reservation;
      },
      update: async ({ where, data }) => {
        const reservation = state.reservations.find((r) => r.id === where.id);
        if (!reservation) throw new Error("reservation not found");
        if (data.active !== undefined) reservation.active = data.active;
        if (data.sourceType !== undefined) reservation.sourceType = data.sourceType;
        if (data.sourceId !== undefined) reservation.sourceId = data.sourceId;
        if (data.startsAt !== undefined) reservation.startsAt = data.startsAt;
        if (data.endsAt !== undefined) reservation.endsAt = data.endsAt;
        reservation.updatedAt = new Date();
        return reservation;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of state.reservations) {
          if (
            r.sourceType === where.sourceType &&
            r.sourceId === where.sourceId &&
            r.active === true
          ) {
            r.active = data.active;
            count++;
          }
        }
        return { count };
      },
      findFirst: async ({ where }) =>
        state.reservations.find(
          (r) =>
            r.sourceType === where.sourceType &&
            r.sourceId === where.sourceId &&
            r.active === true,
        ) ?? null,
    },
    $transaction: async <T>(callback: (tx: TrialDatabase) => Promise<T>): Promise<T> =>
      callback(db),
  };
  return db;
}

/** 创建一个 mock SlotService，返回包含请求时段的可用 slot。 */
function createSlotServiceMock(availableSlots: AvailabilitySlot[] = []): SlotService {
  return {
    list: async () => availableSlots,
    listRange: async () => availableSlots,
  } as unknown as SlotService;
}

// ─── 默认时段 ──────────────────────────────────────────────

const FIXED_NOW = new Date("2026-08-11T00:00:00Z");
const BOOKING_STARTS_AT = new Date("2026-08-15T01:00:00Z"); // 2026-08-15 09:00 北京
const BOOKING_ENDS_AT = new Date("2026-08-15T03:00:00Z"); // 2026-08-15 11:00 北京

/** 创建一个包含 BOOKING_STARTS_AT~BOOKING_ENDS_AT 的可用 slot。 */
function defaultAvailableSlot(): AvailabilitySlot {
  return {
    startsAt: BOOKING_STARTS_AT,
    endsAt: BOOKING_ENDS_AT,
    weekday: 6,
  };
}

function createService(
  state: MockState,
  options: {
    slots?: AvailabilitySlot[];
    clock?: () => Date;
  } = {},
): TrialService {
  resetIds();
  const database = createDatabase(state);
  const conflictService = new ConflictService(database);
  const slotService = createSlotServiceMock(options.slots ?? [defaultAvailableSlot()]);
  return new TrialService(
    database,
    conflictService,
    slotService,
    options.clock ?? (() => FIXED_NOW),
  );
}

function defaultCreateInput(overrides: Partial<{
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  idempotencyKey: string;
  mode: TeachingMode;
  parentNote: string;
}> = {}) {
  return {
    parentProfileId: "parent-1",
    childId: "child-1",
    teacherProfileId: "teacher-1",
    subject: "MATH" as Subject,
    startsAt: BOOKING_STARTS_AT,
    endsAt: BOOKING_ENDS_AT,
    idempotencyKey: "idem-1",
    mode: "ONLINE" as TeachingMode,
    parentNote: "希望老师耐心",
    ...overrides,
  };
}

// ─── create 测试 ──────────────────────────────────────────

describe("TrialService.create", () => {
  it("creates a REQUESTED booking with valid input", async () => {
    const state = defaultState();
    const service = createService(state);

    const result = await service.create(defaultCreateInput());

    expect(result.status).toBe("REQUESTED");
    expect(result.version).toBe(0);
    expect(result.parentProfileId).toBe("parent-1");
    expect(result.childId).toBe("child-1");
    expect(result.teacherProfileId).toBe("teacher-1");
    expect(result.subject).toBe("MATH");
    expect(result.mode).toBe("ONLINE");
    expect(result.parentNote).toBe("希望老师耐心");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].action).toBe("CREATE");
    expect(state.bookings).toHaveLength(1);
  });

  it("is idempotent: same idempotencyKey returns existing booking", async () => {
    const state = defaultState();
    const service = createService(state);

    const first = await service.create(defaultCreateInput());
    const second = await service.create(defaultCreateInput());

    expect(second.id).toBe(first.id);
    expect(state.bookings).toHaveLength(1);
  });

  it("rejects startsAt not in the future", async () => {
    const state = defaultState();
    const service = createService(state);

    await expect(
      service.create(
        defaultCreateInput({
          startsAt: new Date("2026-08-10T00:00:00Z"),
          endsAt: new Date("2026-08-10T02:00:00Z"),
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects startsAt >= endsAt", async () => {
    const state = defaultState();
    const service = createService(state);

    await expect(
      service.create(
        defaultCreateInput({
          startsAt: new Date("2026-08-15T03:00:00Z"),
          endsAt: new Date("2026-08-15T01:00:00Z"),
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects when parent does not own the child", async () => {
    const state = defaultState();
    const service = createService(state);

    await expect(
      service.create(defaultCreateInput({ childId: "child-other" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when teacher is not ACTIVE", async () => {
    const state = defaultState();
    state.teachers[0].serviceStatus = "PAUSED";
    const service = createService(state);

    await expect(
      service.create(defaultCreateInput()),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("rejects when slot is not in teacher availability", async () => {
    const state = defaultState();
    const service = createService(state, { slots: [] });

    await expect(
      service.create(defaultCreateInput()),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("sends notification to teacher on create", async () => {
    const state = defaultState();
    const service = createService(state);

    await service.create(defaultCreateInput());

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].userId).toBe("user-teacher");
    expect(state.notifications[0].type).toBe("TRIAL_REQUESTED");
  });
});

// ─── accept 测试 ──────────────────────────────────────────

describe("TrialService.accept", () => {
  it("transitions REQUESTED → ACCEPTED and creates reservation", async () => {
    const state = defaultState();
    const proposedStart = new Date("2026-08-16T01:00:00Z");
    const proposedEnd = new Date("2026-08-16T03:00:00Z");
    const service = createService(state, {
      slots: [defaultAvailableSlot(), { startsAt: proposedStart, endsAt: proposedEnd, weekday: 0 }],
    });
    const booking = await service.create(defaultCreateInput());

    const result = await service.accept("teacher-1", booking.id, 0);

    expect(result.status).toBe("ACCEPTED");
    expect(result.version).toBe(1);
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].sourceType).toBe("TRIAL");
    expect(state.reservations[0].sourceId).toBe(booking.id);
    expect(state.reservations[0].active).toBe(true);
  });

  it("rejects when caller is not the assigned teacher", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.accept("teacher-other", booking.id, 0),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects on version mismatch (optimistic lock)", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.accept("teacher-1", booking.id, 99),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("rejects illegal transition from ACCEPTED", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    // 已经 ACCEPTED，再次 ACCEPT 应该失败
    await expect(
      service.accept("teacher-1", booking.id, 1),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });

  it("sends notification to parent on accept", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    const notificationsBefore = state.notifications.length;
    await service.accept("teacher-1", booking.id, 0);

    const acceptNotif = state.notifications.slice(notificationsBefore).find(
      (n) => n.type === "TRIAL_ACCEPTED",
    );
    expect(acceptNotif).toBeDefined();
    expect(acceptNotif!.userId).toBe("user-parent");
  });
});

// ─── reject 测试 ──────────────────────────────────────────

describe("TrialService.reject", () => {
  it("transitions REQUESTED → REJECTED", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    const result = await service.reject("teacher-1", booking.id, 0, "时间不合适");

    expect(result.status).toBe("REJECTED");
    expect(result.version).toBe(1);
    expect(state.changes.at(-1)?.action).toBe("REJECT");
    expect(state.changes.at(-1)?.reason).toBe("时间不合适");
  });

  it("rejects when caller is not the assigned teacher", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.reject("teacher-other", booking.id, 0),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

// ─── proposeReschedule 测试 ───────────────────────────────

describe("TrialService.proposeReschedule", () => {
  it("transitions REQUESTED → RESCHEDULE_PROPOSED with proposed times", async () => {
    const state = defaultState();
    const proposedStart = new Date("2026-08-16T01:00:00Z");
    const proposedEnd = new Date("2026-08-16T03:00:00Z");
    const service = createService(state, {
      slots: [defaultAvailableSlot(), { startsAt: proposedStart, endsAt: proposedEnd, weekday: 0 }],
    });
    const booking = await service.create(defaultCreateInput());

    const result = await service.proposeReschedule(
      "teacher-1",
      booking.id,
      0,
      new Date("2026-08-16T01:00:00Z"),
      new Date("2026-08-16T03:00:00Z"),
      "改到周日",
    );

    expect(result.status).toBe("RESCHEDULE_PROPOSED");
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].startsAt).toEqual(proposedStart);
    expect(state.reservations[0].endsAt).toEqual(proposedEnd);
    const lastChange = state.changes.at(-1)!;
    expect(lastChange.action).toBe("PROPOSE_RESCHEDULE");
    expect(lastChange.proposedStartsAt).toEqual(proposedStart);
    expect(lastChange.proposedEndsAt).toEqual(proposedEnd);
    expect(lastChange.reason).toBe("改到周日");
  });

  it("transitions ACCEPTED → RESCHEDULE_PROPOSED", async () => {
    const state = defaultState();
    const proposedStart = new Date("2026-08-16T01:00:00Z");
    const proposedEnd = new Date("2026-08-16T03:00:00Z");
    const service = createService(state, {
      slots: [
        defaultAvailableSlot(),
        {
          startsAt: new Date("2026-08-16T01:00:00Z"),
          endsAt: new Date("2026-08-16T03:00:00Z"),
          weekday: 0,
        },
      ],
    });
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    const result = await service.proposeReschedule(
      "teacher-1",
      booking.id,
      1,
      proposedStart,
      proposedEnd,
    );

    expect(result.status).toBe("RESCHEDULE_PROPOSED");
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].startsAt).toEqual(new Date("2026-08-16T01:00:00Z"));
  });

  it("rejects when proposedStartsAt >= proposedEndsAt", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.proposeReschedule(
        "teacher-1",
        booking.id,
        0,
        new Date("2026-08-16T03:00:00Z"),
        new Date("2026-08-16T01:00:00Z"),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

// ─── parentConfirm 测试 ───────────────────────────────────

describe("TrialService.parentConfirm", () => {
  it("transitions ACCEPTED → PARENT_CONFIRMED, creates Lesson + DataGrant, transfers reservation", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    const result = await service.parentConfirm("parent-1", booking.id, 1);

    expect(result.status).toBe("PARENT_CONFIRMED");
    expect(result.version).toBe(2);

    // 创建了 Lesson
    expect(state.lessons).toHaveLength(1);
    expect(state.lessons[0].trialBookingId).toBe(booking.id);
    expect(state.lessons[0].status).toBe("SCHEDULED");

    // 创建了 DataGrant
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0].sourceBookingId).toBe(booking.id);
    expect(state.grants[0].scopes).toContain("BASIC_PROFILE");
    expect(state.grants[0].scopes).toContain("LEARNING_NEEDS");

    // reservation 从 TRIAL 交接到 LESSON（不释放重新抢占）
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].sourceType).toBe("LESSON");
    expect(state.reservations[0].sourceId).toBe(state.lessons[0].id);
    expect(state.reservations[0].active).toBe(true);
  });

  it("transitions RESCHEDULE_PROPOSED → PARENT_CONFIRMED", async () => {
    const state = defaultState();
    const proposedStart = new Date("2026-08-16T01:00:00Z");
    const proposedEnd = new Date("2026-08-16T03:00:00Z");
    const service = createService(state, {
      slots: [defaultAvailableSlot(), { startsAt: proposedStart, endsAt: proposedEnd, weekday: 0 }],
    });
    const booking = await service.create(defaultCreateInput());
    await service.proposeReschedule(
      "teacher-1",
      booking.id,
      0,
      proposedStart,
      proposedEnd,
    );

    const result = await service.parentConfirm("parent-1", booking.id, 1);

    expect(result.status).toBe("PARENT_CONFIRMED");
    expect(state.lessons[0].startsAt).toEqual(proposedStart);
    expect(state.lessons[0].endsAt).toEqual(proposedEnd);
  });

  it("rejects when caller is not the parent who created the booking", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    await expect(
      service.parentConfirm("parent-other", booking.id, 1),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects illegal transition from REQUESTED (must accept first)", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.parentConfirm("parent-1", booking.id, 0),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });
});

// ─── cancel 测试 ──────────────────────────────────────────

describe("TrialService.cancel", () => {
  it("cancels from REQUESTED and releases reservation (none to release)", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    const result = await service.cancel(
      { kind: "PARENT", id: "parent-1" },
      booking.id,
      0,
      "不想要了",
    );

    expect(result.status).toBe("CANCELLED");
    expect(state.changes.at(-1)?.action).toBe("CANCEL");
    expect(state.changes.at(-1)?.reason).toBe("不想要了");
  });

  it("cancels from ACCEPTED and releases TRIAL reservation", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    expect(state.reservations[0].active).toBe(true);

    const result = await service.cancel(
      { kind: "TEACHER", id: "teacher-1" },
      booking.id,
      1,
    );

    expect(result.status).toBe("CANCELLED");
    // reservation 被释放
    expect(state.reservations[0].active).toBe(false);
  });

  it("rejects cancel from terminal state COMPLETED", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);
    await service.parentConfirm("parent-1", booking.id, 1);
    await service.markReady("teacher-1", booking.id, 2);
    await service.complete("teacher-1", booking.id, 3);

    await expect(
      service.cancel({ kind: "PARENT", id: "parent-1" }, booking.id, 4),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });
});

// ─── markReady 测试 ───────────────────────────────────────

describe("TrialService.markReady", () => {
  it("transitions PARENT_CONFIRMED → READY", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);
    await service.parentConfirm("parent-1", booking.id, 1);

    const result = await service.markReady("teacher-1", booking.id, 2);

    expect(result.status).toBe("READY");
  });

  it("rejects illegal transition from ACCEPTED (must parentConfirm first)", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    await expect(
      service.markReady("teacher-1", booking.id, 1),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });
});

// ─── complete 测试 ────────────────────────────────────────

describe("TrialService.complete", () => {
  it("transitions READY → COMPLETED and updates Lesson", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);
    await service.parentConfirm("parent-1", booking.id, 1);
    await service.markReady("teacher-1", booking.id, 2);

    const result = await service.complete("teacher-1", booking.id, 3);

    expect(result.status).toBe("COMPLETED");
    // Lesson 被标记完成
    expect(state.lessons[0].status).toBe("COMPLETED");
    expect(state.lessons[0].completedAt).not.toBeNull();
  });

  it("rejects illegal transition from PARENT_CONFIRMED (must markReady first)", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);
    await service.parentConfirm("parent-1", booking.id, 1);

    await expect(
      service.complete("teacher-1", booking.id, 2),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
  });
});

// ─── getById 测试 ─────────────────────────────────────────

describe("TrialService.getById", () => {
  it("returns booking detail for the parent", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    const result = await service.getById(booking.id, "parent-1");

    expect(result.id).toBe(booking.id);
    expect(result.changes.length).toBeGreaterThanOrEqual(1);
  });

  it("returns booking detail for the teacher", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    const result = await service.getById(booking.id, "teacher-1");

    expect(result.id).toBe(booking.id);
  });

  it("rejects when viewer is neither parent nor teacher", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());

    await expect(
      service.getById(booking.id, "parent-other"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects when booking not found", async () => {
    const state = defaultState();
    const service = createService(state);

    await expect(
      service.getById("nonexistent", "parent-1"),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

// ─── listByParent / listByTeacher 测试 ────────────────────

describe("TrialService.listByParent", () => {
  it("returns bookings for the parent", async () => {
    const state = defaultState();
    const service = createService(state);
    await service.create(defaultCreateInput({ idempotencyKey: "k1" }));
    await service.create(
      defaultCreateInput({ idempotencyKey: "k2", subject: "ENGLISH" as Subject }),
    );

    const result = await service.listByParent("parent-1");

    expect(result).toHaveLength(2);
  });

  it("filters by status", async () => {
    const state = defaultState();
    const service = createService(state);
    const booking = await service.create(defaultCreateInput());
    await service.accept("teacher-1", booking.id, 0);

    const requested = await service.listByParent("parent-1", "REQUESTED");
    const accepted = await service.listByParent("parent-1", "ACCEPTED");

    expect(requested).toHaveLength(0);
    expect(accepted).toHaveLength(1);
  });
});

describe("TrialService.listByTeacher", () => {
  it("returns bookings for the teacher", async () => {
    const state = defaultState();
    const service = createService(state);
    await service.create(defaultCreateInput({ idempotencyKey: "k1" }));

    const result = await service.listByTeacher("teacher-1");

    expect(result).toHaveLength(1);
    expect(result[0].teacherProfileId).toBe("teacher-1");
  });
});

// ─── 完整生命周期测试 ─────────────────────────────────────

describe("TrialService full lifecycle", () => {
  it("REQUESTED → ACCEPTED → PARENT_CONFIRMED → READY → COMPLETED", async () => {
    const state = defaultState();
    const service = createService(state);

    // create
    const booking = await service.create(defaultCreateInput());
    expect(booking.status).toBe("REQUESTED");
    expect(booking.version).toBe(0);

    // accept
    const accepted = await service.accept("teacher-1", booking.id, 0);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.version).toBe(1);

    // parentConfirm
    const confirmed = await service.parentConfirm("parent-1", booking.id, 1);
    expect(confirmed.status).toBe("PARENT_CONFIRMED");
    expect(confirmed.version).toBe(2);

    // markReady
    const ready = await service.markReady("teacher-1", booking.id, 2);
    expect(ready.status).toBe("READY");
    expect(ready.version).toBe(3);

    // complete
    const completed = await service.complete("teacher-1", booking.id, 3);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.version).toBe(4);

    // 验证变更历史
    const detail = await service.getById(booking.id, "parent-1");
    const actions = detail.changes.map((c) => c.action);
    expect(actions).toContain("CREATE");
    expect(actions).toContain("ACCEPT");
    expect(actions).toContain("PARENT_CONFIRM");
    expect(actions).toContain("MARK_READY");
    expect(actions).toContain("COMPLETE");

    // 验证 Lesson 和 DataGrant 已创建
    expect(state.lessons).toHaveLength(1);
    expect(state.lessons[0].status).toBe("COMPLETED");
    expect(state.grants).toHaveLength(1);

    // 验证 reservation 最终为 LESSON source
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].sourceType).toBe("LESSON");
    expect(state.reservations[0].active).toBe(true);
  });
});

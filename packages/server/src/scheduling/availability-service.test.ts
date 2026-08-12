import { describe, expect, it } from "vitest";
import {
  AvailabilityService,
  type AvailabilityDatabase,
  type WeeklyRuleRecord,
  type ExceptionRecord,
  parseBeijingDateToUtcMidnight,
  beijingMinuteToUtc,
  formatUtcMidnightToDate,
} from "./availability-service";
import { SlotService, type SlotDatabase } from "./slot-service";
import type { AvailabilityExceptionType } from "@prisma/client";

// ─── 测试辅助 ───────────────────────────────────────────────

type MockState = {
  rules: WeeklyRuleRecord[];
  exceptions: ExceptionRecord[];
  reservations: Array<{
    id: string;
    teacherProfileId: string;
    startsAt: Date;
    endsAt: Date;
    active: boolean;
  }>;
};

function createAvailabilityDatabase(state: MockState): AvailabilityDatabase {
  let nextRuleId = state.rules.length + 1;
  const db: AvailabilityDatabase = {
    teacherAvailabilityRule: {
      findMany: async ({ where }) =>
        state.rules
          .filter((r) => r.teacherProfileId === where.teacherProfileId)
          .sort((a, b) => a.weekday - b.weekday),
      deleteMany: async ({ where }) => {
        const before = state.rules.length;
        state.rules = state.rules.filter((r) => r.teacherProfileId !== where.teacherProfileId);
        return { count: before - state.rules.length };
      },
      createMany: async ({ data }) => {
        for (const item of data) {
          const rule: WeeklyRuleRecord = {
            id: `rule-${nextRuleId++}`,
            teacherProfileId: item.teacherProfileId,
            weekday: item.weekday,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          state.rules.push(rule);
        }
        return { count: data.length };
      },
    },
    teacherAvailabilityException: {
      findMany: async ({ where }) =>
        state.exceptions
          .filter((e) => e.teacherProfileId === where.teacherProfileId)
          .sort((a, b) => a.date.getTime() - b.date.getTime()),
      upsert: async ({ where, create, update }) => {
        const idx = state.exceptions.findIndex(
          (e) =>
            e.teacherProfileId === where.teacherProfileId_date.teacherProfileId &&
            e.date.getTime() === where.teacherProfileId_date.date.getTime(),
        );
        if (idx >= 0) {
          Object.assign(state.exceptions[idx], update);
          return state.exceptions[idx];
        }
        const record: ExceptionRecord = {
          id: `exc-${state.exceptions.length + 1}`,
          teacherProfileId: create.teacherProfileId,
          date: create.date,
          type: create.type,
          startMinute: create.startMinute,
          endMinute: create.endMinute,
          reason: create.reason,
          createdAt: new Date(),
        };
        state.exceptions.push(record);
        return record;
      },
    },
    $transaction: async <T>(callback: (tx: AvailabilityDatabase) => Promise<T>): Promise<T> =>
      callback(db),
  };
  return db;
}

function createSlotDatabase(state: MockState): SlotDatabase {
  return {
    teacherAvailabilityRule: {
      findMany: async ({ where }) => {
        let items = state.rules.filter((r) => r.teacherProfileId === where.teacherProfileId);
        if (where.weekday !== undefined) {
          items = items.filter((r) => r.weekday === where.weekday);
        }
        return items;
      },
    },
    teacherAvailabilityException: {
      findMany: async ({ where }) =>
        state.exceptions.filter((e) => {
          if (e.teacherProfileId !== where.teacherProfileId) return false;
          if (where.date.gte && e.date < where.date.gte) return false;
          if (where.date.lte && e.date > where.date.lte) return false;
          return true;
        }),
    },
    scheduleReservation: {
      findMany: async ({ where }) =>
        state.reservations.filter((r) => {
          if (r.teacherProfileId !== where.teacherProfileId) return false;
          if (where.active !== undefined && r.active !== where.active) return false;
          if (where.startsAt.gte && r.startsAt < where.startsAt.gte) return false;
          if (where.startsAt.lte && r.startsAt > where.startsAt.lte) return false;
          return true;
        }),
    },
  };
}

function defaultState(): MockState {
  return { rules: [], exceptions: [], reservations: [] };
}

// ─── AvailabilityService 测试 ──────────────────────────────

describe("AvailabilityService", () => {
  it("replaces all weekly rules for a teacher on setWeekly", async () => {
    const state = defaultState();
    state.rules = [
      {
        id: "rule-old",
        teacherProfileId: "teacher-1",
        weekday: 1,
        startMinute: 540,
        endMinute: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await service.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
      { weekday: 7, startMinute: 540, endMinute: 720 },
    ]);

    expect(state.rules).toHaveLength(2);
    expect(state.rules.map((r) => r.weekday)).toEqual([6, 7]);
    expect(state.rules.every((r) => r.teacherProfileId === "teacher-1")).toBe(true);
  });

  it("clears all weekly rules when setWeekly is called with empty array", async () => {
    const state = defaultState();
    state.rules = [
      {
        id: "rule-old",
        teacherProfileId: "teacher-1",
        weekday: 1,
        startMinute: 540,
        endMinute: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await service.setWeekly("teacher-1", []);

    expect(state.rules).toHaveLength(0);
  });

  it("rejects overlapping weekly rules on the same weekday", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    // 540-720 与 600-780 重叠
    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 6, startMinute: 540, endMinute: 720 },
        { weekday: 6, startMinute: 600, endMinute: 780 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // 不应写入任何规则
    expect(state.rules).toHaveLength(0);
  });

  it("allows adjacent weekly rules on the same weekday", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    // 540-720 与 720-900 相邻，允许
    await service.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
      { weekday: 6, startMinute: 720, endMinute: 900 },
    ]);

    expect(state.rules).toHaveLength(2);
  });

  it("rejects rules with end <= start", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 1, startMinute: 600, endMinute: 600 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 1, startMinute: 720, endMinute: 540 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects rules outside 30-240 minute range", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    // 540-560 只有 20 分钟，小于 30
    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 1, startMinute: 540, endMinute: 560 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // 0-300 共 300 分钟，超过 240
    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 1, startMinute: 0, endMinute: 300 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects weekday outside 1-7", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 0, startMinute: 540, endMinute: 600 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    await expect(
      service.setWeekly("teacher-1", [
        { weekday: 8, startMinute: 540, endMinute: 600 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects invalid date format in setException", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await expect(
      service.setException("teacher-1", "2026/08/15", "UNAVAILABLE"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects AVAILABLE exception without startMinute/endMinute", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await expect(
      service.setException("teacher-1", "2026-08-15", "AVAILABLE"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects exception with only one of startMinute/endMinute", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    await expect(
      service.setException("teacher-1", "2026-08-15", "UNAVAILABLE", 540),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("upserts exception for the same date", async () => {
    const state = defaultState();
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    const first = await service.setException(
      "teacher-1",
      "2026-08-15",
      "UNAVAILABLE",
      540,
      720,
      "请假",
    );
    const second = await service.setException(
      "teacher-1",
      "2026-08-15",
      "AVAILABLE",
      800,
      960,
    );

    expect(state.exceptions).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.type).toBe("AVAILABLE");
    expect(second.startMinute).toBe(800);
    expect(second.endMinute).toBe(960);
    expect(second.reason).toBeNull();
  });

  it("returns weekly rules sorted by weekday", async () => {
    const state = defaultState();
    state.rules = [
      {
        id: "rule-2",
        teacherProfileId: "teacher-1",
        weekday: 7,
        startMinute: 540,
        endMinute: 720,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "rule-1",
        teacherProfileId: "teacher-1",
        weekday: 1,
        startMinute: 540,
        endMinute: 720,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    const rules = await service.getWeekly("teacher-1");

    expect(rules.map((r) => r.weekday)).toEqual([1, 7]);
  });

  it("returns exceptions sorted by date", async () => {
    const state = defaultState();
    state.exceptions = [
      {
        id: "exc-2",
        teacherProfileId: "teacher-1",
        date: parseBeijingDateToUtcMidnight("2026-09-01"),
        type: "UNAVAILABLE" as AvailabilityExceptionType,
        startMinute: null,
        endMinute: null,
        reason: null,
        createdAt: new Date(),
      },
      {
        id: "exc-1",
        teacherProfileId: "teacher-1",
        date: parseBeijingDateToUtcMidnight("2026-08-15"),
        type: "UNAVAILABLE" as AvailabilityExceptionType,
        startMinute: null,
        endMinute: null,
        reason: null,
        createdAt: new Date(),
      },
    ];
    const service = new AvailabilityService(createAvailabilityDatabase(state));

    const exceptions = await service.getExceptions("teacher-1");

    expect(exceptions.map((e) => formatUtcMidnightToDate(e.date))).toEqual([
      "2026-08-15",
      "2026-09-01",
    ]);
  });
});

// ─── SlotService 测试 ──────────────────────────────────────

describe("SlotService", () => {
  it("applies date exceptions over weekly availability", async () => {
    // 设置周六规则 + 8/15 UNAVAILABLE 例外 → 8/15 返回空
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
    ]);
    await availability.setException(
      "teacher-1",
      "2026-08-15",
      "UNAVAILABLE",
      540,
      720,
    );

    // 2026-08-15 是周六
    const result = await slots.list("teacher-1", "2026-08-15", "Asia/Shanghai");
    expect(result).toEqual([]);
  });

  it("returns projected slots from weekly rules when no exception", async () => {
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
    ]);

    const result = await slots.list("teacher-1", "2026-08-15", "Asia/Shanghai");
    expect(result).toHaveLength(1);
    // 540 北京分钟 = 9:00 北京 = 1:00 UTC
    const midnight = parseBeijingDateToUtcMidnight("2026-08-15");
    expect(result[0].startsAt).toEqual(beijingMinuteToUtc(midnight, 540));
    expect(result[0].endsAt).toEqual(beijingMinuteToUtc(midnight, 720));
    expect(result[0].weekday).toBe(6);
  });

  it("UNAVAILABLE full-day exception removes all slots", async () => {
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
      { weekday: 6, startMinute: 780, endMinute: 960 },
    ]);
    // 全天不可用（不传 start/end）
    await availability.setException("teacher-1", "2026-08-15", "UNAVAILABLE");

    const result = await slots.list("teacher-1", "2026-08-15", "Asia/Shanghai");
    expect(result).toEqual([]);
  });

  it("AVAILABLE exception adds extra slot", async () => {
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    // 周日没有周期规则
    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
    ]);
    // 8/16 是周日，添加临时可用时段
    await availability.setException(
      "teacher-1",
      "2026-08-16",
      "AVAILABLE",
      800,
      960,
    );

    const result = await slots.list("teacher-1", "2026-08-16", "Asia/Shanghai");
    expect(result).toHaveLength(1);
    const midnight = parseBeijingDateToUtcMidnight("2026-08-16");
    expect(result[0].startsAt).toEqual(beijingMinuteToUtc(midnight, 800));
    expect(result[0].endsAt).toEqual(beijingMinuteToUtc(midnight, 960));
  });

  it("filters out slots overlapping with active reservations", async () => {
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
      { weekday: 6, startMinute: 780, endMinute: 960 },
    ]);

    // 占用 540-720 的时段
    const midnight = parseBeijingDateToUtcMidnight("2026-08-15");
    state.reservations.push({
      id: "res-1",
      teacherProfileId: "teacher-1",
      startsAt: beijingMinuteToUtc(midnight, 540),
      endsAt: beijingMinuteToUtc(midnight, 720),
      active: true,
    });

    const result = await slots.list("teacher-1", "2026-08-15", "Asia/Shanghai");
    expect(result).toHaveLength(1);
    expect(result[0].startsAt).toEqual(beijingMinuteToUtc(midnight, 780));
    expect(result[0].endsAt).toEqual(beijingMinuteToUtc(midnight, 960));
  });

  it("listRange returns slots across multiple days", async () => {
    const state = defaultState();
    const availability = new AvailabilityService(createAvailabilityDatabase(state));
    const slots = new SlotService(createSlotDatabase(state));

    // 8/15 周六、8/16 周日都加规则
    await availability.setWeekly("teacher-1", [
      { weekday: 6, startMinute: 540, endMinute: 720 },
      { weekday: 7, startMinute: 800, endMinute: 960 },
    ]);

    const result = await slots.listRange(
      "teacher-1",
      "2026-08-15",
      "2026-08-16",
      "Asia/Shanghai",
    );
    expect(result).toHaveLength(2);
  });

  it("rejects unsupported timezone", async () => {
    const state = defaultState();
    const slots = new SlotService(createSlotDatabase(state));

    await expect(
      slots.list("teacher-1", "2026-08-15", "America/New_York"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

/**
 * V2.3 Task 6 老师可授课时间与例外
 *
 * 周期规则使用 Asia/Shanghai 时区概念：weekday（1=周一 … 7=周日）和
 * minute-of-day 都是北京时间。持久层仍用 UTC，但规则字段以北京时间为基准
 * 由 SlotService 在投影时换算为 UTC Date。
 *
 * 校验约束：
 * - weekday ∈ [1, 7]
 * - 0 <= startMinute < endMinute <= 1440
 * - 单段时长 30–240 分钟（含端点）
 * - 同一天规则不可重叠（相邻允许）
 *
 * 例外优先于周期规则：
 * - UNAVAILABLE 整天（startMinute=null）：移除该日所有周期投影
 * - UNAVAILABLE 带具体时段：移除该日与例外时段重叠的投影
 * - AVAILABLE 带具体时段：在该日追加例外时段
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type { AvailabilityExceptionType } from "@prisma/client";

// ─── 常量 ──────────────────────────────────────────────────

/** 北京时间相对 UTC 的偏移量（分钟）：UTC+8 */
export const BEIJING_OFFSET_MINUTES = 8 * 60;
/** 单段最短时长（分钟） */
export const MIN_SEGMENT_MINUTES = 30;
/** 单段最长时长（分钟） */
export const MAX_SEGMENT_MINUTES = 240;
/** 一天的分钟数 */
export const MINUTES_PER_DAY = 24 * 60;

// ─── 记录类型 ───────────────────────────────────────────────

export type WeeklyRuleRecord = {
  id: string;
  teacherProfileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ExceptionRecord = {
  id: string;
  teacherProfileId: string;
  date: Date;
  type: AvailabilityExceptionType;
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
  createdAt: Date;
};

export type WeeklyRuleInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

// ─── 数据库接口（便于测试注入 mock） ────────────────────────

export interface AvailabilityDatabase {
  teacherAvailabilityRule: {
    findMany(args: {
      where: { teacherProfileId: string };
      orderBy?: { weekday: "asc" };
    }): Promise<WeeklyRuleRecord[]>;
    deleteMany(args: { where: { teacherProfileId: string } }): Promise<{ count: number }>;
    createMany(args: {
      data: Array<{
        teacherProfileId: string;
        weekday: number;
        startMinute: number;
        endMinute: number;
      }>;
    }): Promise<{ count: number }>;
  };
  teacherAvailabilityException: {
    findMany(args: {
      where: { teacherProfileId: string };
      orderBy?: { date: "asc" };
    }): Promise<ExceptionRecord[]>;
    upsert(args: {
      where: { teacherProfileId_date: { teacherProfileId: string; date: Date } };
      create: {
        teacherProfileId: string;
        date: Date;
        type: AvailabilityExceptionType;
        startMinute: number | null;
        endMinute: number | null;
        reason: string | null;
      };
      update: {
        type: AvailabilityExceptionType;
        startMinute: number | null;
        endMinute: number | null;
        reason: string | null;
      };
    }): Promise<ExceptionRecord>;
  };
  $transaction<T>(callback: (tx: AvailabilityDatabase) => Promise<T>): Promise<T>;
}

// ─── 时区工具 ──────────────────────────────────────────────

/**
 * 把 "YYYY-MM-DD"（北京日历日期）解析为对应 UTC 当日 0:00 的 Date。
 * 例："2026-08-15" → Date.UTC(2026, 7, 15) → 2026-08-15T00:00:00.000Z。
 *
 * 选择 UTC 当日 0:00 而非北京当日 0:00（即 UTC 前一日 16:00）是为了让
 * 数据库 date 字段的"日期部分"与字符串一致，便于按日期精确匹配。
 */
export function parseBeijingDateToUtcMidnight(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new AppError("VALIDATION_ERROR", 400, `Invalid date format: ${date}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new AppError("VALIDATION_ERROR", 400, `Invalid date: ${date}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/** 把 UTC 当日 0:00 的 Date 转回 "YYYY-MM-DD"。 */
export function formatUtcMidnightToDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * JS getUTCDay 返回 0=周日 … 6=周六；schema 使用 1=周一 … 7=周日。
 */
export function jsDayToSchemaWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * 把北京日历当日 minute-of-day 转换为某日的 UTC Date。
 * midnightUtc 视为该北京日历日期的 UTC 当日 0:00（参考 parseBeijingDateToUtcMidnight）。
 */
export function beijingMinuteToUtc(midnightUtc: Date, minute: number): Date {
  return new Date(midnightUtc.getTime() + (minute - BEIJING_OFFSET_MINUTES) * 60_000);
}

// ─── 校验工具 ──────────────────────────────────────────────

function validateRule(rule: WeeklyRuleInput): void {
  if (
    !Number.isInteger(rule.weekday) ||
    rule.weekday < 1 ||
    rule.weekday > 7
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `weekday must be an integer between 1 and 7, got ${rule.weekday}`,
    );
  }
  if (
    !Number.isInteger(rule.startMinute) ||
    rule.startMinute < 0 ||
    rule.startMinute > MINUTES_PER_DAY
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `startMinute out of range: ${rule.startMinute}`,
    );
  }
  if (
    !Number.isInteger(rule.endMinute) ||
    rule.endMinute < 0 ||
    rule.endMinute > MINUTES_PER_DAY
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `endMinute out of range: ${rule.endMinute}`,
    );
  }
  if (rule.endMinute <= rule.startMinute) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `endMinute (${rule.endMinute}) must be greater than startMinute (${rule.startMinute})`,
    );
  }
  const duration = rule.endMinute - rule.startMinute;
  if (duration < MIN_SEGMENT_MINUTES || duration > MAX_SEGMENT_MINUTES) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `segment duration must be between ${MIN_SEGMENT_MINUTES} and ${MAX_SEGMENT_MINUTES} minutes, got ${duration}`,
    );
  }
}

/** 两条半开区间 [a.start, a.end) 与 [b.start, b.end) 是否重叠。相邻（a.end === b.start）不算重叠。 */
function segmentsOverlap(
  a: { startMinute: number; endMinute: number },
  b: { startMinute: number; endMinute: number },
): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** 校验同一天的规则集合内部不存在重叠。 */
function validateNoOverlap(rules: WeeklyRuleInput[]): void {
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (segmentsOverlap(rules[i], rules[j])) {
        throw new AppError(
          "VALIDATION_ERROR",
          400,
          `overlapping rules on weekday ${rules[i].weekday}: [${rules[i].startMinute},${rules[i].endMinute}) vs [${rules[j].startMinute},${rules[j].endMinute})`,
        );
      }
    }
  }
}

// ─── 服务 ───────────────────────────────────────────────────

export class AvailabilityService {
  constructor(
    private readonly database: AvailabilityDatabase = prisma as unknown as AvailabilityDatabase,
  ) {}

  /**
   * 替换该老师的全部周期规则。
   * - 先在内存校验所有规则
   * - 在事务内删除旧规则并写入新规则
   */
  async setWeekly(
    teacherProfileId: string,
    rules: WeeklyRuleInput[],
  ): Promise<void> {
    // 单条校验
    for (const rule of rules) validateRule(rule);

    // 按天分组做重叠校验
    const byWeekday = new Map<number, WeeklyRuleInput[]>();
    for (const rule of rules) {
      const bucket = byWeekday.get(rule.weekday);
      if (bucket) bucket.push(rule);
      else byWeekday.set(rule.weekday, [rule]);
    }
    for (const bucket of byWeekday.values()) validateNoOverlap(bucket);

    await this.database.$transaction(async (tx) => {
      await tx.teacherAvailabilityRule.deleteMany({
        where: { teacherProfileId },
      });
      if (rules.length === 0) return;
      await tx.teacherAvailabilityRule.createMany({
        data: rules.map((rule) => ({
          teacherProfileId,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        })),
      });
    });
  }

  /**
   * 设置/替换某天的例外。例外按 (teacherProfileId, date) 唯一。
   * - type=AVAILABLE 必须提供 startMinute 和 endMinute
   * - type=UNAVAILABLE 可省略 startMinute/endMinute 表示全天不可用
   * - 提供 startMinute 时必须同时提供 endMinute，且 startMinute < endMinute
   */
  async setException(
    teacherProfileId: string,
    date: string,
    type: AvailabilityExceptionType,
    startMinute?: number | null,
    endMinute?: number | null,
    reason?: string | null,
  ): Promise<ExceptionRecord> {
    const dateUtc = parseBeijingDateToUtcMidnight(date);

    const start = startMinute ?? null;
    const end = endMinute ?? null;

    if ((start === null) !== (end === null)) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        "startMinute and endMinute must be both present or both absent",
      );
    }
    if (start !== null && end !== null) {
      if (
        !Number.isInteger(start) ||
        start < 0 ||
        start > MINUTES_PER_DAY
      ) {
        throw new AppError("VALIDATION_ERROR", 400, `startMinute out of range: ${start}`);
      }
      if (
        !Number.isInteger(end) ||
        end < 0 ||
        end > MINUTES_PER_DAY
      ) {
        throw new AppError("VALIDATION_ERROR", 400, `endMinute out of range: ${end}`);
      }
      if (end <= start) {
        throw new AppError(
          "VALIDATION_ERROR",
          400,
          `endMinute (${end}) must be greater than startMinute (${start})`,
        );
      }
    }
    if (type === "AVAILABLE" && (start === null || end === null)) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        "AVAILABLE exception must specify startMinute and endMinute",
      );
    }

    return this.database.teacherAvailabilityException.upsert({
      where: { teacherProfileId_date: { teacherProfileId, date: dateUtc } },
      create: {
        teacherProfileId,
        date: dateUtc,
        type,
        startMinute: start,
        endMinute: end,
        reason: reason ?? null,
      },
      update: {
        type,
        startMinute: start,
        endMinute: end,
        reason: reason ?? null,
      },
    });
  }

  /** 返回该老师的全部周期规则（按 weekday 升序）。 */
  async getWeekly(teacherProfileId: string): Promise<WeeklyRuleRecord[]> {
    return this.database.teacherAvailabilityRule.findMany({
      where: { teacherProfileId },
      orderBy: { weekday: "asc" },
    });
  }

  /** 返回该老师的全部例外（按 date 升序）。 */
  async getExceptions(teacherProfileId: string): Promise<ExceptionRecord[]> {
    return this.database.teacherAvailabilityException.findMany({
      where: { teacherProfileId },
      orderBy: { date: "asc" },
    });
  }
}

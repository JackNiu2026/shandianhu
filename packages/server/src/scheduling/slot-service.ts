/**
 * V2.3 Task 6 可授课时段投影
 *
 * SlotService 把老师的周期规则 + 例外投影为具体的 UTC Date 段，
 * 并扣除已被 ScheduleReservation 占用的时段。
 *
 * 投影规则：
 * 1. 根据日期对应的 weekday 找到周期规则，按北京时间 minute-of-day 转换为 UTC Date
 * 2. 应用例外（UNAVAILABLE 移除、AVAILABLE 追加）
 * 3. 过滤掉与 active ScheduleReservation 重叠的时段
 * 4. 按 startsAt 升序返回
 *
 * timezone 参数目前仅支持 Asia/Shanghai（周期规则以北京时间为基准）。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import {
  beijingMinuteToUtc,
  formatUtcMidnightToDate,
  jsDayToSchemaWeekday,
  parseBeijingDateToUtcMidnight,
  type ExceptionRecord,
  type WeeklyRuleRecord,
} from "./availability-service";

// ─── 类型 ──────────────────────────────────────────────────

export type AvailabilitySlot = {
  startsAt: Date;
  endsAt: Date;
  weekday: number;
};

export type ReservationRecord = {
  id: string;
  teacherProfileId: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
};

// ─── 数据库接口 ─────────────────────────────────────────────

export interface SlotDatabase {
  teacherAvailabilityRule: {
    findMany(args: {
      where: { teacherProfileId: string; weekday?: number };
    }): Promise<WeeklyRuleRecord[]>;
  };
  teacherAvailabilityException: {
    findMany(args: {
      where: {
        teacherProfileId: string;
        date: { gte: Date; lte: Date };
      };
    }): Promise<ExceptionRecord[]>;
  };
  scheduleReservation: {
    findMany(args: {
      where: {
        teacherProfileId: string;
        active: boolean;
        startsAt: { gte: Date; lte: Date };
      };
    }): Promise<ReservationRecord[]>;
  };
}

// ─── 工具 ──────────────────────────────────────────────────

/** 两条半开区间 [a.start, a.end) 与 [b.start, b.end) 是否重叠。 */
function slotsOverlap(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * 校验 timezone 是否受支持。当前仅支持 Asia/Shanghai。
 */
function assertSupportedTimezone(timezone: string): void {
  if (timezone !== "Asia/Shanghai") {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `Unsupported timezone: ${timezone}. Only Asia/Shanghai is supported.`,
    );
  }
}

/**
 * 计算从 startDate 到 endDate（含）每一天的 UTC 0:00 Date 数组。
 * 输入为 "YYYY-MM-DD" 字符串。
 */
function utcMidnightsInRange(startDate: string, endDate: string): Date[] {
  const start = parseBeijingDateToUtcMidnight(startDate);
  const end = parseBeijingDateToUtcMidnight(endDate);
  if (end < start) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      `endDate (${endDate}) must not be earlier than startDate (${startDate})`,
    );
  }
  const midnights: Date[] = [];
  const dayMs = 24 * 60 * 60_000;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    midnights.push(new Date(t));
  }
  return midnights;
}

// ─── 服务 ───────────────────────────────────────────────────

export class SlotService {
  constructor(
    private readonly database: SlotDatabase = prisma as unknown as SlotDatabase,
  ) {}

  /**
   * 返回某一天的可用时段。
   * date 为 "YYYY-MM-DD"（北京日历日期）。
   */
  async list(
    teacherProfileId: string,
    date: string,
    timezone: string,
  ): Promise<AvailabilitySlot[]> {
    assertSupportedTimezone(timezone);
    const midnight = parseBeijingDateToUtcMidnight(date);
    return this.projectDay(teacherProfileId, midnight);
  }

  /**
   * 返回日期范围内的可用时段（含起止日）。
   */
  async listRange(
    teacherProfileId: string,
    startDate: string,
    endDate: string,
    timezone: string,
  ): Promise<AvailabilitySlot[]> {
    assertSupportedTimezone(timezone);
    const midnights = utcMidnightsInRange(startDate, endDate);

    const [rules, exceptions, reservations] = await Promise.all([
      this.database.teacherAvailabilityRule.findMany({
        where: { teacherProfileId },
      }),
      this.database.teacherAvailabilityException.findMany({
        where: {
          teacherProfileId,
          date: { gte: midnights[0], lte: midnights[midnights.length - 1] },
        },
      }),
      this.database.scheduleReservation.findMany({
        where: {
          teacherProfileId,
          active: true,
          startsAt: { gte: midnights[0], lte: new Date(midnights[midnights.length - 1].getTime() + 24 * 60 * 60_000) },
        },
      }),
    ]);

    const exceptionByDateKey = new Map<string, ExceptionRecord>();
    for (const exception of exceptions) {
      exceptionByDateKey.set(formatUtcMidnightToDate(exception.date), exception);
    }

    const allSlots: AvailabilitySlot[] = [];
    for (const midnight of midnights) {
      const dateKey = formatUtcMidnightToDate(midnight);
      const exception = exceptionByDateKey.get(dateKey);
      const daySlots = this.projectDayInternal(midnight, rules, exception ?? null);
      allSlots.push(...daySlots);
    }

    // 过滤已被占用的时段
    const filtered = allSlots.filter(
      (slot) => !reservations.some((reservation) => slotsOverlap(slot, reservation)),
    );

    return filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /** 投影单日（含查询数据库）。 */
  private async projectDay(
    teacherProfileId: string,
    midnight: Date,
  ): Promise<AvailabilitySlot[]> {
    const schemaWeekday = jsDayToSchemaWeekday(midnight.getUTCDay());
    const dayEndUtc = new Date(midnight.getTime() + 24 * 60 * 60_000);

    const [rules, exceptions, reservations] = await Promise.all([
      this.database.teacherAvailabilityRule.findMany({
        where: { teacherProfileId, weekday: schemaWeekday },
      }),
      this.database.teacherAvailabilityException.findMany({
        where: {
          teacherProfileId,
          date: { gte: midnight, lte: midnight },
        },
      }),
      this.database.scheduleReservation.findMany({
        where: {
          teacherProfileId,
          active: true,
          startsAt: { gte: midnight, lte: dayEndUtc },
        },
      }),
    ]);

    const exception = exceptions[0] ?? null;
    const slots = this.projectDayInternal(midnight, rules, exception);

    return slots
      .filter(
        (slot) => !reservations.some((reservation) => slotsOverlap(slot, reservation)),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  /**
   * 投影单日（纯函数，便于复用与测试）。
   * - UNAVAILABLE 整天（startMinute=null）：返回空数组
   * - UNAVAILABLE 带时段：从周期投影中移除与例外时段重叠的项
   * - AVAILABLE 带时段：在周期投影之外追加例外时段
   */
  private projectDayInternal(
    midnight: Date,
    rules: WeeklyRuleRecord[],
    exception: ExceptionRecord | null,
  ): AvailabilitySlot[] {
    const schemaWeekday = jsDayToSchemaWeekday(midnight.getUTCDay());

    // UNAVAILABLE 整天不可用：直接返回空
    if (exception && exception.type === "UNAVAILABLE" && exception.startMinute === null) {
      return [];
    }

    const projected: AvailabilitySlot[] = [];
    const matchingRules = rules.filter((rule) => rule.weekday === schemaWeekday);
    for (const rule of matchingRules) {
      projected.push({
        startsAt: beijingMinuteToUtc(midnight, rule.startMinute),
        endsAt: beijingMinuteToUtc(midnight, rule.endMinute),
        weekday: rule.weekday,
      });
    }

    if (exception && exception.type === "UNAVAILABLE" && exception.startMinute !== null && exception.endMinute !== null) {
      const exceptStart = beijingMinuteToUtc(midnight, exception.startMinute);
      const exceptEnd = beijingMinuteToUtc(midnight, exception.endMinute);
      // 移除与例外时段重叠的投影（保守处理：完全或部分重叠都移除）
      for (let i = projected.length - 1; i >= 0; i--) {
        if (slotsOverlap(projected[i], { startsAt: exceptStart, endsAt: exceptEnd })) {
          projected.splice(i, 1);
        }
      }
    }

    if (exception && exception.type === "AVAILABLE" && exception.startMinute !== null && exception.endMinute !== null) {
      projected.push({
        startsAt: beijingMinuteToUtc(midnight, exception.startMinute),
        endsAt: beijingMinuteToUtc(midnight, exception.endMinute),
        weekday: schemaWeekday,
      });
    }

    return projected.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}

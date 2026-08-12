/**
 * V2.3 推荐服务
 *
 * 职责：
 * 1. 拉取孩子上下文（grade、learningGoals、薄弱知识点、家长服务区域）
 * 2. 拉取所有 TeacherProfile 并转换为 TeacherCandidate 快照
 * 3. 为每位老师投影未来 N 天的具体可用时段（规则 + 例外 + 已占用）
 * 4. 调用 rankTeachers 进行确定性排序与可解释原因生成
 * 5. 输出 RecommendationResult（对外 DTO）或 TeacherProfileSummary（自主浏览）
 *
 * 设计原则：
 * - 推荐结果可复算：相同输入产生相同排序
 * - 不向家长暴露 MBTI、心理诊断等敏感画像字段（由 buildReasons 过滤）
 * - 不包含任何佣金/支付逻辑
 */
import type { Subject, SchoolStage } from "@prisma/client";
import type {
  RecommendationItem,
  RecommendationResult,
  TeacherProfileSummary,
  TeachingMode,
} from "@lightning-tiger/shared/api";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { stageForGrade } from "../agents/catalog";
import { rankTeachers } from "./score";
import type {
  AvailabilitySlot,
  ChildContextForMatch,
  TeacherCandidate,
} from "./types";

/** 北京时间相对 UTC 的偏移量（分钟）：UTC+8 */
const BEIJING_OFFSET_MINUTES = 8 * 60;
/** 推荐时段投影天数：未来 14 天 */
const SLOT_PROJECTION_DAYS = 14;
/** 推荐结果最多返回条数 */
const MAX_RECOMMENDATION_ITEMS = 20;
/** 自主浏览默认返回上限 */
const DEFAULT_LIST_ALL_LIMIT = 50;

/** 周几工具：JS getDay() 返回 0=周日 … 6=周六；schema 使用 1=周一 … 7=周日 */
function jsDayToSchemaWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** 把 Beijing 当日分钟偏移转换为某日的 UTC Date */
function beijingMinuteToUtc(dateMidnightUtc: Date, minute: number): Date {
  // dateMidnightUtc 视为当日北京时间 0:00 对应的 UTC（即 UTC 当日 16:00 前一天）
  // 实际实现：以 UTC 当日 0:00 为基准，减去北京偏移再加分钟
  return new Date(dateMidnightUtc.getTime() + (minute - BEIJING_OFFSET_MINUTES) * 60_000);
}

/** 计算从基准日起未来 N 天的 UTC 当日 0:00 数组 */
function upcomingUtcMidnights(now: Date, days: number): Date[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Array.from({ length: days }, (_, index) => new Date(start.getTime() + index * 24 * 60 * 60_000));
}

/** 两条时段是否重叠（半开区间 [start, end)） */
function slotsOverlap(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

// ─── 数据库接口（便于测试 mock） ────────────────────────────

export interface RecommendationTeacherRecord {
  id: string;
  displayName: string;
  bio: string;
  subjects: Subject[];
  schoolStages: SchoolStage[];
  teachingModes: TeachingMode[];
  serviceAreaCodes: string[];
  teachingTags: string[];
  experienceYears: number;
  pricePerHour: number;
  serviceStatus: "ACTIVE" | "PAUSED" | "BANNED";
}

export interface RecommendationAvailabilityRule {
  id: string;
  teacherProfileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface RecommendationAvailabilityException {
  id: string;
  teacherProfileId: string;
  date: Date;
  type: "AVAILABLE" | "UNAVAILABLE";
  startMinute: number | null;
  endMinute: number | null;
}

export interface RecommendationScheduleReservation {
  id: string;
  teacherProfileId: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
}

export interface RecommendationTutoringSummary {
  id: string;
  childId: string;
  summary: unknown;
  createdAt: Date;
}

export interface RecommendationChildRecord {
  id: string;
  parentProfileId: string;
  name: string;
  grade: string | null;
  learningGoals: string[];
  deletedAt: Date | null;
}

export interface RecommendationParentProfileRecord {
  id: string;
  userId: string;
  serviceAreaCode: string | null;
}

export interface RecommendationDatabase {
  parentProfile: {
    findUnique(args: { where: { id: string } }): Promise<RecommendationParentProfileRecord | null>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<RecommendationChildRecord | null>;
  };
  teacherProfile: {
    findMany(args: {
      where?: { serviceStatus?: "ACTIVE" | "PAUSED" | "BANNED"; subjects?: { has: Subject } };
      orderBy?: unknown;
    }): Promise<RecommendationTeacherRecord[]>;
  };
  teacherAvailabilityRule: {
    findMany(args: {
      where: { teacherProfileId: { in: string[] } };
    }): Promise<RecommendationAvailabilityRule[]>;
  };
  teacherAvailabilityException: {
    findMany(args: {
      where: { teacherProfileId: { in: string[] }; date: { gte: Date; lte: Date } };
    }): Promise<RecommendationAvailabilityException[]>;
  };
  scheduleReservation: {
    findMany(args: {
      where: { teacherProfileId: { in: string[] }; active: true; startsAt: { gte: Date; lte: Date } };
    }): Promise<RecommendationScheduleReservation[]>;
  };
  tutoringSummary: {
    findMany(args: {
      where: { childId: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<RecommendationTutoringSummary[]>;
  };
  parentReview: {
    aggregate(args: {
      where: { teacherProfileId: string };
      _avg: { rating: true };
      _count: { rating: true };
    }): Promise<{ _avg: { rating: number | null }; _count: { rating: number } }>;
  };
}

// ─── 服务实现 ──────────────────────────────────────────────

export interface RecommendInput {
  parentProfileId: string;
  childId: string;
  subject: Subject;
  preferredMode?: TeachingMode;
  budgetMaxPerHour?: number;
  minExperienceYears?: number;
  preferredStartsAt?: string;
  preferredEndsAt?: string;
}

export interface ListAllInput {
  subject: Subject;
  schoolStage?: SchoolStage;
  limit?: number;
}

export class RecommendationService {
  constructor(
    private readonly database: RecommendationDatabase = prisma as unknown as RecommendationDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * 推荐入口：
   * 1. 校验家长-孩子关系
   * 2. 构造 ChildContextForMatch（含 weakKnowledgePoints 提取）
   * 3. 拉取所有 TeacherProfile 并转 TeacherCandidate
   * 4. 为每位老师投影可用时段
   * 5. rankTeachers 排序
   * 6. 转 RecommendationItem[] 并返回结果（最多 20 条）
   */
  async recommend(input: RecommendInput): Promise<RecommendationResult> {
    const child = await this.database.child.findUnique({ where: { id: input.childId } });
    if (!child || child.deletedAt) {
      throw new AppError("NOT_FOUND", 404, "Child not found");
    }
    if (child.parentProfileId !== input.parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    }
    const parent = await this.database.parentProfile.findUnique({ where: { id: input.parentProfileId } });
    if (!parent) {
      throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    }

    const schoolStage = stageForGrade(child.grade);
    if (!schoolStage) {
      throw new AppError("VALIDATION_ERROR", 400, "Child grade is not recognized");
    }

    const weakKnowledgePoints = await this.extractWeakKnowledgePoints(child.id);
    const childContext: ChildContextForMatch = {
      childId: child.id,
      grade: child.grade,
      schoolStage,
      subject: input.subject,
      weakKnowledgePoints,
      learningGoals: child.learningGoals,
      teachingPreferences: [],
      serviceAreaCode: parent.serviceAreaCode,
    };

    const teachers = await this.database.teacherProfile.findMany({});
    const candidates = teachers.map((record) => this.toCandidate(record));

    const scheduleMap = await this.buildScheduleMap(candidates.map((c) => c.id));

    const ranked = rankTeachers(candidates, {
      child: childContext,
      preferredMode: input.preferredMode,
      budgetMaxPerHour: input.budgetMaxPerHour,
      minExperienceYears: input.minExperienceYears,
      preferredStartsAt: input.preferredStartsAt ? new Date(input.preferredStartsAt) : undefined,
      preferredEndsAt: input.preferredEndsAt ? new Date(input.preferredEndsAt) : undefined,
    }, scheduleMap);

    const items = ranked.slice(0, MAX_RECOMMENDATION_ITEMS).map((entry) => this.toRecommendationItem(entry));

    return {
      items,
      hardFilteredCount: candidates.length - ranked.length,
    };
  }

  /**
   * 自主浏览：绕过软评分，但保留 ACTIVE + 科目/学段硬条件。
   * 返回按创建顺序排序的 TeacherProfileSummary 列表。
   */
  async listAll(input: ListAllInput): Promise<TeacherProfileSummary[]> {
    const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIST_ALL_LIMIT, DEFAULT_LIST_ALL_LIMIT));
    const teachers = await this.database.teacherProfile.findMany({
      where: { serviceStatus: "ACTIVE", subjects: { has: input.subject } },
    });
    const filtered = teachers.filter((teacher) => {
      if (input.schoolStage && !teacher.schoolStages.includes(input.schoolStage)) return false;
      return true;
    });
    const summaries = await Promise.all(
      filtered.slice(0, limit).map((teacher) => this.toTeacherProfileSummary(teacher)),
    );
    return summaries;
  }

  // ─── 内部辅助方法 ──────────────────────────────────────

  /**
   * 从孩子最近的 TutoringSummary 中提取薄弱知识点。
   * TutoringSummary.summary 的 JSON 结构包含 knowledgePoints 数组，
   * 每项 { name: string; performance: "STRONG" | "MIXED" | "WEAK" }，
   * 我们只保留 performance === "WEAK" 的 name。
   */
  private async extractWeakKnowledgePoints(childId: string): Promise<string[]> {
    const summaries = await this.database.tutoringSummary.findMany({
      where: { childId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const points = new Set<string>();
    for (const record of summaries) {
      const summary = asRecord(record.summary);
      const knowledgePoints = Array.isArray(summary.knowledgePoints) ? summary.knowledgePoints : [];
      for (const point of knowledgePoints) {
        const pointRecord = asRecord(point);
        const name = typeof pointRecord.name === "string" ? pointRecord.name : null;
        const performance = typeof pointRecord.performance === "string" ? pointRecord.performance : null;
        if (name && performance === "WEAK") {
          points.add(name);
        }
      }
    }
    return Array.from(points);
  }

  /** 把 Prisma TeacherProfile 记录投影为内部 TeacherCandidate。 */
  private toCandidate(record: RecommendationTeacherRecord): TeacherCandidate {
    return {
      id: record.id,
      displayName: record.displayName,
      subjects: record.subjects,
      schoolStages: record.schoolStages,
      teachingModes: record.teachingModes,
      serviceAreaCodes: record.serviceAreaCodes,
      teachingTags: record.teachingTags,
      experienceYears: record.experienceYears,
      pricePerHour: record.pricePerHour,
      serviceStatus: record.serviceStatus,
    };
  }

  /**
   * 为一组老师构建可用时段映射：
   * 1. 拉取每位老师的周期规则和未来 N 天的例外
   * 2. 拉取未来 N 天内已生效的 ScheduleReservation
   * 3. 对周期规则投影到具体日期 → 应用例外 → 减去已占用时段
   */
  private async buildScheduleMap(teacherIds: string[]): Promise<Map<string, AvailabilitySlot[]>> {
    const result = new Map<string, AvailabilitySlot[]>();
    if (teacherIds.length === 0) return result;

    const now = this.clock();
    const midnights = upcomingUtcMidnights(now, SLOT_PROJECTION_DAYS);
    const windowStart = midnights[0];
    const windowEnd = new Date(midnights[midnights.length - 1].getTime() + 24 * 60 * 60_000);

    const [rules, exceptions, reservations] = await Promise.all([
      this.database.teacherAvailabilityRule.findMany({
        where: { teacherProfileId: { in: teacherIds } },
      }),
      this.database.teacherAvailabilityException.findMany({
        where: { teacherProfileId: { in: teacherIds }, date: { gte: windowStart, lte: windowEnd } },
      }),
      this.database.scheduleReservation.findMany({
        where: {
          teacherProfileId: { in: teacherIds },
          active: true,
          startsAt: { gte: windowStart, lte: windowEnd },
        },
      }),
    ]);

    const rulesByTeacher = groupBy(rules, (rule) => rule.teacherProfileId);
    const exceptionsByTeacher = groupBy(exceptions, (exception) => exception.teacherProfileId);
    const reservationsByTeacher = groupBy(reservations, (reservation) => reservation.teacherProfileId);

    for (const teacherId of teacherIds) {
      const teacherRules = rulesByTeacher.get(teacherId) ?? [];
      const teacherExceptions = exceptionsByTeacher.get(teacherId) ?? [];
      const teacherReservations = reservationsByTeacher.get(teacherId) ?? [];

      const slots = this.projectSlots(teacherRules, teacherExceptions, teacherReservations, midnights);
      result.set(teacherId, slots);
    }

    return result;
  }

  /**
   * 把周期规则投影到具体日期，应用例外，再减去已占用时段。
   */
  private projectSlots(
    rules: RecommendationAvailabilityRule[],
    exceptions: RecommendationAvailabilityException[],
    reservations: RecommendationScheduleReservation[],
    midnights: Date[],
  ): AvailabilitySlot[] {
    const exceptionByDate = new Map<string, RecommendationAvailabilityException>();
    for (const exception of exceptions) {
      const dateKey = utcMidnightToDateString(exception.date);
      exceptionByDate.set(dateKey, exception);
    }

    const projected: AvailabilitySlot[] = [];
    for (const midnight of midnights) {
      const dateKey = utcMidnightToDateString(midnight);
      const jsDay = midnight.getUTCDay();
      const schemaWeekday = jsDayToSchemaWeekday(jsDay);
      const exception = exceptionByDate.get(dateKey);

      // 例外：UNAVAILABLE 整天不可用，直接跳过该日
      if (exception && exception.type === "UNAVAILABLE" && exception.startMinute === null) {
        continue;
      }

      // 周期规则投影
      const matchingRules = rules.filter((rule) => rule.weekday === schemaWeekday);
      for (const rule of matchingRules) {
        const startsAt = beijingMinuteToUtc(midnight, rule.startMinute);
        const endsAt = beijingMinuteToUtc(midnight, rule.endMinute);
        projected.push({ startsAt, endsAt, weekday: rule.weekday });
      }

      // 例外：AVAILABLE 整天可用，添加例外指定的时段
      if (exception && exception.type === "AVAILABLE" && exception.startMinute !== null && exception.endMinute !== null) {
        const startsAt = beijingMinuteToUtc(midnight, exception.startMinute);
        const endsAt = beijingMinuteToUtc(midnight, exception.endMinute);
        projected.push({ startsAt, endsAt, weekday: schemaWeekday });
      }
      // 例外：UNAVAILABLE 但带具体时段：从该日已投影的 slots 中减去例外时段
      if (exception && exception.type === "UNAVAILABLE" && exception.startMinute !== null && exception.endMinute !== null) {
        const exceptStart = beijingMinuteToUtc(midnight, exception.startMinute);
        const exceptEnd = beijingMinuteToUtc(midnight, exception.endMinute);
        const dayKey = dateKey;
        // 移除当天的所有 slot，再添加 [day_start, except_start) 和 [except_end, day_end)
        const daySlots = projected.filter((slot) => utcMidnightToDateString(slot.startsAt) === dayKey);
        for (const slot of daySlots) {
          // 简化实现：完全落在例外内的移除；部分重叠的也移除（保守）
          if (slotsOverlap(slot, { startsAt: exceptStart, endsAt: exceptEnd })) {
            const index = projected.indexOf(slot);
            if (index >= 0) projected.splice(index, 1);
          }
        }
      }
    }

    // 减去已占用时段（ScheduleReservation）
    const filtered = projected.filter(
      (slot) => !reservations.some((reservation) => slotsOverlap(slot, reservation)),
    );

    // 按时间升序返回
    return filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  /** 把 RankedTeacher 映射为对外 DTO RecommendationItem。 */
  private toRecommendationItem(entry: {
    teacher: TeacherCandidate;
    score: { total: number };
    reasons: Array<{ code: string; text: string }>;
    availabilitySlots: AvailabilitySlot[];
  }): RecommendationItem {
    const teacher = entry.teacher;
    return {
      teacherId: teacher.id,
      displayName: teacher.displayName,
      subjects: teacher.subjects,
      schoolStages: teacher.schoolStages,
      experienceYears: teacher.experienceYears,
      pricePerHour: teacher.pricePerHour,
      teachingModes: teacher.teachingModes,
      teachingTags: teacher.teachingTags,
      score: Math.round(entry.score.total * 10) / 10,
      reasons: entry.reasons,
      availabilitySlots: entry.availabilitySlots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        weekday: slot.weekday,
      })),
    };
  }

  /** 把 Prisma TeacherProfile 记录投影为对外 DTO TeacherProfileSummary。 */
  private async toTeacherProfileSummary(record: RecommendationTeacherRecord): Promise<TeacherProfileSummary> {
    const aggregate = await this.database.parentReview.aggregate({
      where: { teacherProfileId: record.id },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      id: record.id,
      displayName: record.displayName,
      bio: record.bio,
      subjects: record.subjects,
      schoolStages: record.schoolStages,
      teachingModes: record.teachingModes,
      serviceAreaCodes: record.serviceAreaCodes,
      teachingTags: record.teachingTags,
      experienceYears: record.experienceYears,
      pricePerHour: record.pricePerHour,
      serviceStatus: record.serviceStatus,
      avgRating: aggregate._avg.rating,
      reviewCount: aggregate._count.rating,
    };
  }
}

// ─── 工具函数 ─────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = result.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      result.set(key, [item]);
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function utcMidnightToDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

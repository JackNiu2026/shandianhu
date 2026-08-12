/**
 * V2.3 Task 8 事务化排期冲突控制
 *
 * ScheduleReservation 是 TrialBooking 和 Lesson 共享的占位表，由 PostgreSQL
 * btree_gist 排他约束保护（同一老师 active=true 的时段不可重叠）。
 *
 * ConflictService 封装三个原子操作：
 * - checkAndReserve：在事务内创建占位，排他约束冲突 → RESOURCE_CONFLICT
 * - release：把占位设为 active=false（释放但保留历史）
 * - transferSource：把 reservation 的 source 从 TRIAL 交接到 LESSON，
 *   不释放重新抢占（避免在交接窗口被其他事务抢占）
 *
 * 所有写操作支持传入 tx（事务客户端）以与外层 TrialService 事务组合。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type { ScheduleSourceType } from "@prisma/client";

// ─── 常量 ──────────────────────────────────────────────────

/** Prisma 已知错误码：唯一约束违反 */
const PRISMA_UNIQUE_VIOLATION = "P2002";
/** PostgreSQL 错误码：排他约束违反（exclusion constraint） */
const PG_EXCLUSION_VIOLATION = "23P10";

// ─── 类型 ──────────────────────────────────────────────────

export type ReservationRecord = {
  id: string;
  teacherProfileId: string;
  sourceType: ScheduleSourceType;
  sourceId: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── 数据库接口 ─────────────────────────────────────────────

export interface ConflictDatabase {
  scheduleReservation: {
    create(args: {
      data: {
        teacherProfileId: string;
        sourceType: ScheduleSourceType;
        sourceId: string;
        startsAt: Date;
        endsAt: Date;
        active?: boolean;
      };
    }): Promise<ReservationRecord>;
    update(args: {
      where: { id: string };
      data: Partial<{
        active: boolean;
        sourceType: ScheduleSourceType;
        sourceId: string;
        startsAt: Date;
        endsAt: Date;
      }>;
    }): Promise<ReservationRecord>;
    updateMany(args: {
      where: { sourceType: ScheduleSourceType; sourceId: string; active: true };
      data: { active: boolean };
    }): Promise<{ count: number }>;
    findFirst(args: {
      where: { sourceType: ScheduleSourceType; sourceId: string; active: true };
    }): Promise<ReservationRecord | null>;
  };
}

// ─── 工具 ──────────────────────────────────────────────────

/**
 * 判断错误是否为排他约束违反（ScheduleReservation_no_overlap）。
 * Prisma 会把 PG 23P10 包装为内部错误，code 可能是 P2000 或未知。
 */
function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  // Prisma 已知错误码 P2000（值超出约束）有时也会触发，但更可靠的是检查 message
  const code = (error as { code?: unknown }).code;
  if (code === PG_EXCLUSION_VIOLATION) return true;
  // Prisma 包装后的 code 通常是 P2000 或不可预期，需进一步检查 message
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") {
    return (
      message.includes("ScheduleReservation_no_overlap") ||
      message.includes("exclusion constraint") ||
      message.includes("overlaps")
    );
  }
  return false;
}

/**
 * 判断错误是否为唯一约束违反（sourceType + sourceId 重复）。
 */
function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code !== PRISMA_UNIQUE_VIOLATION) return false;
  if (!target) return true;
  const meta = (error as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return false;
  const targets = (meta as { target?: unknown }).target as unknown[] | undefined;
  return Array.isArray(targets) && targets.includes(target);
}

// ─── 服务 ───────────────────────────────────────────────────

export class ConflictService {
  constructor(
    private readonly database: ConflictDatabase = prisma as unknown as ConflictDatabase,
  ) {}

  /**
   * 在事务内创建 ScheduleReservation。
   * - 排他约束冲突（时段重叠）→ AppError("RESOURCE_CONFLICT", 409, "时段冲突")
   * - 唯一约束冲突（sourceType+sourceId 已存在）→ AppError("RESOURCE_CONFLICT", 409)
   * - 返回 reservation id
   *
   * tx 可选：传入则在外层事务内执行；不传则用默认 database。
   */
  async checkAndReserve(
    teacherProfileId: string,
    sourceType: ScheduleSourceType,
    sourceId: string,
    startsAt: Date,
    endsAt: Date,
    tx?: ConflictDatabase,
  ): Promise<string> {
    const db = tx ?? this.database;
    if (!(startsAt < endsAt)) {
      throw new AppError("VALIDATION_ERROR", 400, "startsAt must be earlier than endsAt");
    }
    try {
      const reservation = await db.scheduleReservation.create({
        data: {
          teacherProfileId,
          sourceType,
          sourceId,
          startsAt,
          endsAt,
          active: true,
        },
      });
      return reservation.id;
    } catch (error) {
      if (isExclusionViolation(error) || isUniqueViolation(error, "sourceType")) {
        throw new AppError("RESOURCE_CONFLICT", 409, "时段冲突");
      }
      throw error;
    }
  }

  /**
   * 把指定 reservation 设为 active=false（释放占位）。
   * 不删除记录，保留历史。
   */
  async release(reservationId: string, tx?: ConflictDatabase): Promise<void> {
    const db = tx ?? this.database;
    await db.scheduleReservation.update({
      where: { id: reservationId },
      data: { active: false },
    });
  }

  /**
   * 按 source 释放当前 active 的 reservation（用于取消试听/课程时释放）。
   */
  async releaseBySource(
    sourceType: ScheduleSourceType,
    sourceId: string,
    tx?: ConflictDatabase,
  ): Promise<void> {
    const db = tx ?? this.database;
    await db.scheduleReservation.updateMany({
      where: { sourceType, sourceId, active: true },
      data: { active: false },
    });
  }

  /**
   * 把 reservation 的 source 从 oldSource 交接到 newSource，不释放重新抢占。
   * - 用于家长确认试听时把 TRIAL reservation 接力为 LESSON reservation
   * - 更新 sourceType + sourceId，保持 active=true 和时段不变
   * - 唯一约束冲突（newSource 已存在 reservation）→ RESOURCE_CONFLICT
   */
  async transferSource(
    oldSourceType: ScheduleSourceType,
    oldSourceId: string,
    newSourceType: ScheduleSourceType,
    newSourceId: string,
    tx?: ConflictDatabase,
  ): Promise<void> {
    const db = tx ?? this.database;
    const reservation = await db.scheduleReservation.findFirst({
      where: { sourceType: oldSourceType, sourceId: oldSourceId, active: true },
    });
    if (!reservation) {
      throw new AppError(
        "NOT_FOUND",
        404,
        `No active reservation for ${oldSourceType}:${oldSourceId}`,
      );
    }
    try {
      await db.scheduleReservation.update({
        where: { id: reservation.id },
        data: { sourceType: newSourceType, sourceId: newSourceId },
      });
    } catch (error) {
      if (isUniqueViolation(error, "sourceType")) {
        throw new AppError(
          "RESOURCE_CONFLICT",
          409,
          `Target source ${newSourceType}:${newSourceId} already has a reservation`,
        );
      }
      throw error;
    }
  }

  /** Move an active reservation without releasing the source identity. */
  async replaceTimeRange(
    sourceType: ScheduleSourceType,
    sourceId: string,
    startsAt: Date,
    endsAt: Date,
    tx?: ConflictDatabase,
  ): Promise<boolean> {
    const db = tx ?? this.database;
    if (!(startsAt < endsAt)) {
      throw new AppError("VALIDATION_ERROR", 400, "startsAt must be earlier than endsAt");
    }
    const reservation = await db.scheduleReservation.findFirst({
      where: { sourceType, sourceId, active: true },
    });
    if (!reservation) return false;
    try {
      await db.scheduleReservation.update({
        where: { id: reservation.id },
        data: { startsAt, endsAt },
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new AppError("RESOURCE_CONFLICT", 409, "Requested time conflicts with another booking");
      }
      throw error;
    }
    return true;
  }

  /** 仅供测试或外部事务查询 reservation 是否存在。 */
  async findBySource(
    sourceType: ScheduleSourceType,
    sourceId: string,
    tx?: ConflictDatabase,
  ): Promise<ReservationRecord | null> {
    const db = tx ?? this.database;
    return db.scheduleReservation.findFirst({
      where: { sourceType, sourceId, active: true },
    });
  }
}

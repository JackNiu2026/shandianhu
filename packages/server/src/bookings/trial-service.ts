/**
 * V2.3 Task 7 试听预约服务
 *
 * 职责：
 * - create：家长为 activeChild 向 ACTIVE 老师提交未来可用时段的试听申请
 * - accept/reject/proposeReschedule：老师侧动作
 * - parentConfirm：家长确认，创建 Lesson + DataGrant，把 reservation 从 TRIAL 接力到 LESSON
 * - cancel：非终态取消，释放 reservation
 * - markReady/complete：老师推进到就绪和完成
 * - getById/listByParent/listByTeacher：查询
 *
 * 安全与一致性：
 * - 所有写操作在 $transaction 内执行
 * - 接受/改期/确认必须携带 version（乐观锁）
 * - 时段冲突通过 ScheduleReservation 排他约束保护，统一映射 RESOURCE_CONFLICT
 * - 不泄露其他家庭信息（冲突消息不包含其他 booking 详情）
 * - 幂等：(parentProfileId, idempotencyKey) 唯一
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import { ConflictService, type ConflictDatabase } from "../scheduling/conflict-service";
import { SlotService } from "../scheduling/slot-service";
import { transition, type TrialEvent } from "./trial-state-machine";
import { BEIJING_OFFSET_MINUTES } from "../scheduling/availability-service";
import type {
  Subject,
  TeachingMode,
  ScheduleSourceType,
  LessonStatus,
  DataGrantScope,
  TeacherServiceStatus,
} from "@prisma/client";
import type {
  TrialBookingStatus,
  TrialBookingDetail,
  BookingChangeDto,
} from "@lightning-tiger/shared/api";

// ─── 常量 ──────────────────────────────────────────────────

/** Prisma 已知错误码：记录未找到（update/delete 时 where 不匹配） */
const PRISMA_RECORD_NOT_FOUND = "P2025";
/** Prisma 已知错误码：唯一约束违反 */
const PRISMA_UNIQUE_VIOLATION = "P2002";
/** DataGrant 默认有效期：课程结束后 7 天 */
const DATA_GRANT_VALIDITY_DAYS = 7;

// ─── 记录类型 ───────────────────────────────────────────────

export type TrialBookingRecord = {
  id: string;
  idempotencyKey: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  status: TrialBookingStatus;
  mode: TeachingMode | null;
  parentNote: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BookingChangeRecord = {
  id: string;
  bookingId: string;
  fromStatus: TrialBookingStatus;
  toStatus: TrialBookingStatus;
  action: string;
  actorKind: string;
  actorId: string;
  reason: string | null;
  proposedStartsAt: Date | null;
  proposedEndsAt: Date | null;
  createdAt: Date;
};

export type LessonRecord = {
  id: string;
  trialBookingId: string | null;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  status: LessonStatus;
  mode: TeachingMode | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ParentProfileRecord = {
  id: string;
  userId: string;
  children: Array<{ id: string }>;
};

type TeacherProfileRecord = {
  id: string;
  userId: string;
  serviceStatus: TeacherServiceStatus;
  subjects?: Subject[];
  teachingModes?: TeachingMode[];
};

// ─── 输入类型 ───────────────────────────────────────────────

export type CreateTrialInput = {
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  idempotencyKey: string;
  mode?: TeachingMode;
  parentNote?: string;
};

export type TrialActor = { kind: "PARENT" | "TEACHER"; id: string };

// ─── 数据库接口 ─────────────────────────────────────────────

export interface TrialDatabase {
  parentProfile: {
    findUnique(args: {
      where: { id: string };
      include?: {
        children?: { where: { id: string }; select: { id: true } };
      };
    }): Promise<ParentProfileRecord | null>;
  };
  teacherProfile: {
    findUnique(args: {
      where: { id: string };
    }): Promise<TeacherProfileRecord | null>;
  };
  trialBooking: {
    findUnique(args: { where: { id: string } }): Promise<TrialBookingRecord | null>;
    findFirst(args: {
      where: { parentProfileId: string; idempotencyKey: string };
    }): Promise<TrialBookingRecord | null>;
    findMany(args: {
      where: {
        parentProfileId?: string;
        teacherProfileId?: string;
        status?: TrialBookingStatus;
      };
      orderBy: { createdAt: "desc" };
    }): Promise<TrialBookingRecord[]>;
    create(args: {
      data: {
        idempotencyKey: string;
        parentProfileId: string;
        childId: string;
        teacherProfileId: string;
        subject: Subject;
        startsAt: Date;
        endsAt: Date;
        status: TrialBookingStatus;
        mode: TeachingMode | null;
        parentNote: string | null;
        version: number;
      };
    }): Promise<TrialBookingRecord>;
    update(args: {
      where: { id: string; version: number };
      data: Partial<{
        status: TrialBookingStatus;
        startsAt: Date;
        endsAt: Date;
        version: { increment: number };
      }>;
    }): Promise<TrialBookingRecord | null>;
  };
  bookingChange: {
    create(args: {
      data: {
        bookingId: string;
        fromStatus: TrialBookingStatus;
        toStatus: TrialBookingStatus;
        action: string;
        actorKind: string;
        actorId: string;
        reason: string | null;
        proposedStartsAt: Date | null;
        proposedEndsAt: Date | null;
      };
    }): Promise<unknown>;
    findMany(args: {
      where: { bookingId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<BookingChangeRecord[]>;
  };
  lesson: {
    create(args: {
      data: {
        trialBookingId: string;
        childId: string;
        teacherProfileId: string;
        subject: Subject;
        startsAt: Date;
        endsAt: Date;
        status: LessonStatus;
        mode: TeachingMode | null;
      };
    }): Promise<LessonRecord>;
    update(args: {
      where: { id: string };
      data: Partial<{ status: LessonStatus; completedAt: Date }>;
    }): Promise<LessonRecord>;
    findUnique(args: { where: { trialBookingId: string } }): Promise<LessonRecord | null>;
  };
  dataGrant: {
    create(args: {
      data: {
        parentProfileId: string;
        childId: string;
        teacherProfileId: string;
        scopes: DataGrantScope[];
        validFrom: Date;
        validUntil: Date;
        sourceBookingId: string;
      };
    }): Promise<unknown>;
  };
  notification: {
    upsert(args: {
      where: { dedupeKey: string };
      create: {
        userId: string;
        type: string;
        dedupeKey: string;
        body: Record<string, unknown>;
        targetRoute: string | null;
        targetParams: Record<string, unknown> | null;
      };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: TrialDatabase) => Promise<T>): Promise<T>;
}

// ─── 工具 ──────────────────────────────────────────────────

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === PRISMA_RECORD_NOT_FOUND
  );
}

function isPrismaUniqueViolation(error: unknown, target?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code !== PRISMA_UNIQUE_VIOLATION) return false;
  if (!target) return true;
  const meta = (error as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return false;
  const targets = (meta as { target?: unknown }).target as unknown[] | undefined;
  return Array.isArray(targets) && targets.includes(target);
}

/** 把 UTC Date 转换为对应的北京日历日期字符串 "YYYY-MM-DD"。 */
function utcDateToBeijingDateString(date: Date): string {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MINUTES * 60_000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, "0")}-${String(
    beijing.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 两条半开区间 [a.start, a.end) 与 [b.start, b.end) 是否重叠。 */
function rangesOverlap(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** 判断 requested 是否完全落在 available 内（含端点）。 */
function rangeContains(
  available: { startsAt: Date; endsAt: Date },
  requested: { startsAt: Date; endsAt: Date },
): boolean {
  return available.startsAt <= requested.startsAt && requested.endsAt <= available.endsAt;
}

// ─── 服务 ───────────────────────────────────────────────────

export class TrialService {
  constructor(
    private readonly database: TrialDatabase = prisma as unknown as TrialDatabase,
    private readonly conflictService: ConflictService = new ConflictService(
      prisma as unknown as ConflictDatabase,
    ),
    private readonly slotService: SlotService = new SlotService(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ─── create ──────────────────────────────────────────────

  /**
   * 家长提交试听申请。
   * - 校验家长拥有 childId
   * - 校验老师是 ACTIVE
   * - 校验时段在未来
   * - 校验时段在老师的可用时间内
   * - 幂等：(parentProfileId, idempotencyKey) 唯一
   * - 创建 TrialBooking(REQUESTED) + BookingChange
   * - 发通知给老师
   */
  async create(input: CreateTrialInput): Promise<TrialBookingDetail> {
    // 幂等快速路径
    const existing = await this.database.trialBooking.findFirst({
      where: { parentProfileId: input.parentProfileId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return this.getById(existing.id, input.parentProfileId);
    }

    const now = this.clock();

    // 校验时段
    if (!(input.startsAt < input.endsAt)) {
      throw new AppError("VALIDATION_ERROR", 400, "startsAt must be earlier than endsAt");
    }
    if (input.startsAt <= now) {
      throw new AppError("VALIDATION_ERROR", 400, "startsAt must be in the future");
    }

    // 校验家长拥有 child
    const parent = await this.database.parentProfile.findUnique({
      where: { id: input.parentProfileId },
      include: { children: { where: { id: input.childId }, select: { id: true } } },
    });
    if (!parent) {
      throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    }
    if (!parent.children || parent.children.length === 0) {
      throw new AppError("FORBIDDEN", 403, "Child does not belong to this parent");
    }

    // 校验老师是 ACTIVE
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: input.teacherProfileId },
    });
    if (!teacher) {
      throw new AppError("NOT_FOUND", 404, "Teacher profile not found");
    }
    if (teacher.serviceStatus !== "ACTIVE") {
      throw new AppError("RESOURCE_CONFLICT", 409, "Teacher is not active");
    }
    if (teacher.subjects && !teacher.subjects.includes(input.subject)) {
      throw new AppError("RESOURCE_CONFLICT", 409, "Teacher does not teach the requested subject");
    }
    if (input.mode && teacher.teachingModes && !teacher.teachingModes.includes(input.mode)) {
      throw new AppError("RESOURCE_CONFLICT", 409, "Teacher does not support the requested teaching mode");
    }

    // 校验时段在老师的可用时间内
    await this.assertSlotAvailable(input.teacherProfileId, input.startsAt, input.endsAt);

    // 创建 TrialBooking + BookingChange + 通知
    const booking = await this.database.$transaction(async (tx) => {
      let created: TrialBookingRecord;
      try {
        created = await tx.trialBooking.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            parentProfileId: input.parentProfileId,
            childId: input.childId,
            teacherProfileId: input.teacherProfileId,
            subject: input.subject,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            status: "REQUESTED",
            mode: input.mode ?? null,
            parentNote: input.parentNote ?? null,
            version: 0,
          },
        });
      } catch (error) {
        // 并发幂等：另一个事务先创建了相同 (parentProfileId, idempotencyKey)
        if (isPrismaUniqueViolation(error, "parentProfileId")) {
          throw new AppError("RESOURCE_CONFLICT", 409, "Trial booking already exists");
        }
        throw error;
      }

      await tx.bookingChange.create({
        data: {
          bookingId: created.id,
          fromStatus: "REQUESTED",
          toStatus: "REQUESTED",
          action: "CREATE",
          actorKind: "PARENT",
          actorId: input.parentProfileId,
          reason: input.parentNote ?? null,
          proposedStartsAt: null,
          proposedEndsAt: null,
        },
      });

      // 通知老师
      await tx.notification.upsert({
        where: {
          dedupeKey: `trial-requested:${created.id}:${created.version}`,
        },
        create: {
          userId: teacher.userId,
          type: "TRIAL_REQUESTED",
          dedupeKey: `trial-requested:${created.id}:${created.version}`,
          body: {
            bookingId: created.id,
            childId: created.childId,
            parentProfileId: created.parentProfileId,
            subject: created.subject,
            startsAt: created.startsAt.toISOString(),
            endsAt: created.endsAt.toISOString(),
          },
          targetRoute: "/pages/teacher-work/index",
          targetParams: { bookingId: created.id },
        },
        update: {},
      });

      return created;
    });

    const changes = await this.database.bookingChange.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
    });
    return this.toDetail(booking, changes);
  }

  // ─── accept ──────────────────────────────────────────────

  /**
   * 老师接受试听。
   * - 仅该老师可接受
   * - 状态机 REQUESTED → ACCEPTED
   * - 乐观锁：校验 version
   * - 创建 ScheduleReservation(sourceType=TRIAL, sourceId=bookingId)
   * - 追加 BookingChange
   * - 通知家长
   */
  async accept(
    teacherProfileId: string,
    bookingId: string,
    version: number,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, teacherProfileId, "TEACHER", version, "ACCEPT", {
      preState: "REQUESTED",
      postState: "ACCEPTED",
      action: "ACCEPT",
      notificationType: "TRIAL_ACCEPTED",
      notificationTarget: "parent",
      afterStatusUpdate: async (booking, tx) => {
        // 创建排期占位，排他约束保护
        await this.conflictService.checkAndReserve(
          booking.teacherProfileId,
          "TRIAL",
          booking.id,
          booking.startsAt,
          booking.endsAt,
          tx as unknown as ConflictDatabase,
        );
      },
    });
  }

  // ─── reject ──────────────────────────────────────────────

  /**
   * 老师拒绝试听。
   * - 状态机 REQUESTED → REJECTED
   * - 追加 BookingChange + 通知家长
   */
  async reject(
    teacherProfileId: string,
    bookingId: string,
    version: number,
    reason?: string,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, teacherProfileId, "TEACHER", version, "REJECT", {
      preState: "REQUESTED",
      postState: "REJECTED",
      action: "REJECT",
      reason,
      notificationType: "TRIAL_REJECTED",
      notificationTarget: "parent",
    });
  }

  // ─── proposeReschedule ───────────────────────────────────

  /**
   * 老师建议改期。
   * - 状态机 → RESCHEDULE_PROPOSED
   * - 追加 BookingChange（含 proposedStartsAt/EndsAt）
   * - 通知家长
   */
  async proposeReschedule(
    teacherProfileId: string,
    bookingId: string,
    version: number,
    proposedStartsAt: Date,
    proposedEndsAt: Date,
    reason?: string,
  ): Promise<TrialBookingDetail> {
    if (!(proposedStartsAt < proposedEndsAt)) {
      throw new AppError("VALIDATION_ERROR", 400, "proposedStartsAt must be earlier than proposedEndsAt");
    }
    if (proposedStartsAt <= this.clock()) {
      throw new AppError("VALIDATION_ERROR", 400, "proposedStartsAt must be in the future");
    }

    return this.applyTransition(bookingId, teacherProfileId, "TEACHER", version, "PROPOSE_RESCHEDULE", {
      preState: undefined, // REQUESTED 或 ACCEPTED 都可以
      postState: "RESCHEDULE_PROPOSED",
      action: "PROPOSE_RESCHEDULE",
      reason,
      proposedStartsAt,
      proposedEndsAt,
      replacementTimeRange: { startsAt: proposedStartsAt, endsAt: proposedEndsAt },
      notificationType: "TRIAL_RESCHEDULE_PROPOSED",
      notificationTarget: "parent",
      beforeStatusUpdate: async (booking) => {
        await this.assertSlotAvailable(booking.teacherProfileId, proposedStartsAt, proposedEndsAt);
      },
      afterStatusUpdate: async (booking, tx) => {
        const replaced = await this.conflictService.replaceTimeRange(
          "TRIAL",
          booking.id,
          booking.startsAt,
          booking.endsAt,
          tx as unknown as ConflictDatabase,
        );
        if (!replaced) {
          await this.conflictService.checkAndReserve(
            booking.teacherProfileId,
            "TRIAL",
            booking.id,
            booking.startsAt,
            booking.endsAt,
            tx as unknown as ConflictDatabase,
          );
        }
      },
    });
  }

  // ─── parentConfirm ───────────────────────────────────────

  /**
   * 家长确认试听。
   * - 状态机 ACCEPTED 或 RESCHEDULE_PROPOSED → PARENT_CONFIRMED
   * - 创建 Lesson + DataGrant(scopes=[BASIC_PROFILE, LEARNING_NEEDS], validUntil=endsAt+7天)
   * - 把 ScheduleReservation 的 source 从 TRIAL 交接到 LESSON
   * - 追加 BookingChange + 通知老师
   */
  async parentConfirm(
    parentProfileId: string,
    bookingId: string,
    version: number,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, parentProfileId, "PARENT", version, "PARENT_CONFIRM", {
      preState: undefined, // ACCEPTED 或 RESCHEDULE_PROPOSED 都可以
      postState: "PARENT_CONFIRMED",
      action: "PARENT_CONFIRM",
      notificationType: "TRIAL_CONFIRMED",
      notificationTarget: "teacher",
      afterStatusUpdate: async (booking, tx) => {
        // 创建 Lesson
        const lesson = await tx.lesson.create({
          data: {
            trialBookingId: booking.id,
            childId: booking.childId,
            teacherProfileId: booking.teacherProfileId,
            subject: booking.subject,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            status: "SCHEDULED",
            mode: booking.mode,
          },
        });

        // 创建 DataGrant
        const validUntil = new Date(booking.endsAt.getTime() + DATA_GRANT_VALIDITY_DAYS * 24 * 60 * 60_000);
        await tx.dataGrant.create({
          data: {
            parentProfileId: booking.parentProfileId,
            childId: booking.childId,
            teacherProfileId: booking.teacherProfileId,
            scopes: ["BASIC_PROFILE", "LEARNING_NEEDS"],
            validFrom: this.clock(),
            validUntil,
            sourceBookingId: booking.id,
          },
        });

        // 把 reservation 的 source 从 TRIAL 接力到 LESSON（不释放重新抢占）
        await this.conflictService.transferSource(
          "TRIAL",
          booking.id,
          "LESSON",
          lesson.id,
          tx as unknown as ConflictDatabase,
        );
      },
    });
  }

  // ─── cancel ──────────────────────────────────────────────

  /**
   * 取消试听（家长或老师）。
   * - 非终态 → CANCELLED
   * - 释放 ScheduleReservation（active=false）
   * - 追加 BookingChange + 通知
   */
  async cancel(
    actor: TrialActor,
    bookingId: string,
    version: number,
    reason?: string,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, actor.id, actor.kind, version, "CANCEL", {
      preState: undefined, // 任何非终态都可以
      postState: "CANCELLED",
      action: "CANCEL",
      reason,
      notificationType: "TRIAL_CANCELLED",
      notificationTarget: "other", // 通知非发起方
      afterStatusUpdate: async (booking, _tx) => {
        // 释放排期占位（按 source 查找并设 active=false）
        await this.conflictService.releaseBySource(
          "TRIAL",
          booking.id,
          _tx as unknown as ConflictDatabase,
        );
      },
    });
  }

  // ─── markReady ───────────────────────────────────────────

  /**
   * 老师标记就绪。
   * - PARENT_CONFIRMED → READY
   */
  async markReady(
    teacherProfileId: string,
    bookingId: string,
    version: number,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, teacherProfileId, "TEACHER", version, "MARK_READY", {
      preState: "PARENT_CONFIRMED",
      postState: "READY",
      action: "MARK_READY",
      notificationType: null,
      notificationTarget: null,
    });
  }

  // ─── complete ────────────────────────────────────────────

  /**
   * 老师标记完成。
   * - READY → COMPLETED
   * - 更新 Lesson.status = COMPLETED, completedAt
   */
  async complete(
    teacherProfileId: string,
    bookingId: string,
    version: number,
  ): Promise<TrialBookingDetail> {
    return this.applyTransition(bookingId, teacherProfileId, "TEACHER", version, "COMPLETE", {
      preState: "READY",
      postState: "COMPLETED",
      action: "COMPLETE",
      notificationType: "TRIAL_COMPLETED",
      notificationTarget: "parent",
      afterStatusUpdate: async (booking, tx) => {
        const lesson = await tx.lesson.findUnique({
          where: { trialBookingId: booking.id },
        });
        if (lesson) {
          await tx.lesson.update({
            where: { id: lesson.id },
            data: { status: "COMPLETED", completedAt: this.clock() },
          });
        }
      },
    });
  }

  // ─── 查询 ────────────────────────────────────────────────

  /** 获取试听详情（含变更历史）。viewerId 用于权限校验。 */
  async getById(bookingId: string, viewerId: string): Promise<TrialBookingDetail> {
    const booking = await this.database.trialBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new AppError("NOT_FOUND", 404, "Trial booking not found");
    }
    // 权限：只有该家长或该老师可以查看
    if (booking.parentProfileId !== viewerId && booking.teacherProfileId !== viewerId) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this booking");
    }
    const changes = await this.database.bookingChange.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    });
    return this.toDetail(booking, changes);
  }

  /** 家长的试听列表。 */
  async listByParent(
    parentProfileId: string,
    status?: TrialBookingStatus,
  ): Promise<TrialBookingRecord[]> {
    return this.database.trialBooking.findMany({
      where: { parentProfileId, status },
      orderBy: { createdAt: "desc" },
    });
  }

  /** 老师的试听列表。 */
  async listByTeacher(
    teacherProfileId: string,
    status?: TrialBookingStatus,
  ): Promise<TrialBookingRecord[]> {
    return this.database.trialBooking.findMany({
      where: { teacherProfileId, status },
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /**
   * 校验请求的时段落在老师的可用时间内（周期规则 + 例外 - 已占用）。
   * 可用时段由 SlotService 投影。
   */
  private async assertSlotAvailable(
    teacherProfileId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const beijingDate = utcDateToBeijingDateString(startsAt);
    const slots = await this.slotService.list(teacherProfileId, beijingDate, "Asia/Shanghai");
    const contained = slots.some((slot) => rangeContains(slot, { startsAt, endsAt }));
    if (!contained) {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        "Requested slot is not within teacher's available time",
      );
    }
  }

  /**
   * 通用的状态转换应用方法。
   * - 加载 booking → 校验权限 → 校验 version → 状态机 → 事务内更新
   * - afterStatusUpdate 回调在事务内 status 更新后执行（如创建 reservation/lesson）
   */
  private async applyTransition(
    bookingId: string,
    actorId: string,
    actorKind: "PARENT" | "TEACHER",
    version: number,
    event: TrialEvent,
    options: {
      preState: TrialBookingStatus | undefined;
      postState: TrialBookingStatus;
      action: string;
      reason?: string;
      proposedStartsAt?: Date;
      proposedEndsAt?: Date;
      replacementTimeRange?: { startsAt: Date; endsAt: Date };
      notificationType: string | null;
      notificationTarget: "parent" | "teacher" | "other" | null;
      beforeStatusUpdate?: (booking: TrialBookingRecord) => Promise<void>;
      afterStatusUpdate?: (booking: TrialBookingRecord, tx: TrialDatabase) => Promise<void>;
    },
  ): Promise<TrialBookingDetail> {
    // 加载 booking
    const booking = await this.database.trialBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new AppError("NOT_FOUND", 404, "Trial booking not found");
    }

    // 权限校验
    if (actorKind === "TEACHER" && booking.teacherProfileId !== actorId) {
      throw new AppError("FORBIDDEN", 403, "Only the assigned teacher can perform this action");
    }
    if (actorKind === "PARENT" && booking.parentProfileId !== actorId) {
      throw new AppError("FORBIDDEN", 403, "Only the parent who created the booking can perform this action");
    }

    // 乐观锁：校验 version
    if (booking.version !== version) {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        "Booking version mismatch, please refresh and retry",
      );
    }

    // 可选前置状态校验
    if (options.preState && booking.status !== options.preState) {
      // 让状态机抛出更准确的错误
    }

    // 状态机校验
    const newStatus = transition(booking.status, event);

    // 加载通知目标信息（在事务外减少事务内 IO）
    const notifyTarget = await this.resolveNotificationTarget(booking, options.notificationTarget, actorKind);

    // 事务内执行
    const updated = await this.database.$transaction(async (tx) => {
      if (options.beforeStatusUpdate) {
        await options.beforeStatusUpdate(booking);
      }
      // 乐观锁更新
      let next: TrialBookingRecord | null;
      try {
        next = await tx.trialBooking.update({
          where: { id: booking.id, version: booking.version },
          data: {
            status: newStatus,
            ...(options.replacementTimeRange ?? {}),
            version: { increment: 1 },
          },
        });
      } catch (error) {
        if (isPrismaRecordNotFound(error)) {
          next = null;
        } else {
          throw error;
        }
      }
      if (!next) {
        throw new AppError(
          "RESOURCE_CONFLICT",
          409,
          "Booking was modified concurrently, please refresh and retry",
        );
      }

      // 追加 BookingChange
      await tx.bookingChange.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: newStatus,
          action: options.action,
          actorKind,
          actorId,
          reason: options.reason ?? null,
          proposedStartsAt: options.proposedStartsAt ?? null,
          proposedEndsAt: options.proposedEndsAt ?? null,
        },
      });

      // 执行后置回调（如创建 reservation/lesson/datagrant）
      if (options.afterStatusUpdate) {
        await options.afterStatusUpdate(next, tx);
      }

      // 发送通知
      if (options.notificationType && notifyTarget) {
        await tx.notification.upsert({
          where: {
            dedupeKey: `${options.notificationType.toLowerCase()}:${booking.id}:${next.version}`,
          },
          create: {
            userId: notifyTarget.userId,
            type: options.notificationType,
            dedupeKey: `${options.notificationType.toLowerCase()}:${booking.id}:${next.version}`,
            body: {
              bookingId: booking.id,
              actorKind,
              actorId,
              reason: options.reason ?? null,
              proposedStartsAt: options.proposedStartsAt?.toISOString() ?? null,
              proposedEndsAt: options.proposedEndsAt?.toISOString() ?? null,
            },
            targetRoute: notifyTarget.route,
            targetParams: { bookingId: booking.id },
          },
          update: {},
        });
      }

      return next;
    });

    // 重新加载 changes（事务内创建的）
    const changes = await this.database.bookingChange.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    });
    return this.toDetail(updated, changes);
  }

  /**
   * 解析通知目标（userId 和目标路由）。
   * notificationTarget="parent" → 通知家长
   * notificationTarget="teacher" → 通知老师
   * notificationTarget="other" → 通知非发起方（家长发起则通知老师，老师发起则通知家长）
   */
  private async resolveNotificationTarget(
    booking: TrialBookingRecord,
    target: "parent" | "teacher" | "other" | null,
    actorKind: "PARENT" | "TEACHER",
  ): Promise<{ userId: string; route: string } | null> {
    if (!target) return null;
    let resolveAsParent: boolean;
    if (target === "parent") resolveAsParent = true;
    else if (target === "teacher") resolveAsParent = false;
    else resolveAsParent = actorKind === "TEACHER"; // other: 老师发起 → 通知家长

    if (resolveAsParent) {
      const parent = await this.database.parentProfile.findUnique({
        where: { id: booking.parentProfileId },
      });
      if (!parent) return null;
      return { userId: parent.userId, route: "/pages/me/index" };
    }
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: booking.teacherProfileId },
    });
    if (!teacher) return null;
    return { userId: teacher.userId, route: "/pages/teacher-work/index" };
  }

  /** 把记录转为对外 DTO。teacherDisplayName 由 API 层补充。 */
  private toDetail(
    booking: TrialBookingRecord,
    changes: BookingChangeRecord[],
  ): TrialBookingDetail {
    return {
      id: booking.id,
      idempotencyKey: booking.idempotencyKey,
      parentProfileId: booking.parentProfileId,
      childId: booking.childId,
      teacherProfileId: booking.teacherProfileId,
      teacherDisplayName: null,
      subject: booking.subject,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      mode: booking.mode,
      parentNote: booking.parentNote,
      version: booking.version,
      createdAt: booking.createdAt.toISOString(),
      changes: changes.map((c) => this.toChangeDto(c)),
    };
  }

  private toChangeDto(c: BookingChangeRecord): BookingChangeDto {
    return {
      id: c.id,
      fromStatus: c.fromStatus,
      toStatus: c.toStatus,
      action: c.action,
      actorKind: c.actorKind,
      reason: c.reason,
      proposedStartsAt: c.proposedStartsAt?.toISOString() ?? null,
      proposedEndsAt: c.proposedEndsAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}

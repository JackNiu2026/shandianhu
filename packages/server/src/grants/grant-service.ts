/**
 * V2.3 最小范围 DataGrant 与老师学生摘要
 *
 * 家长在确认试听时通过 DataGrant 向老师授权最小范围的孩子学习数据访问。
 * 老师只能在有效服务关系和 grant 范围内读取必要摘要；
 * 撤销后立即失效。返回的 StudentSummaryDto 严格排除敏感字段
 * （家长手机号、原始错题、AI 对话原文、MBTI、学校名称等）。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type {
  DataGrantScope,
  TeacherServiceStatus,
  TrialBookingStatus,
  LessonStatus,
  Subject,
} from "@prisma/client";
import type {
  StudentSummaryDto,
  DataGrantSummary,
} from "@lightning-tiger/shared/api";

/** 默认授权范围：基础资料 + 学习需求 */
const DEFAULT_SCOPES: DataGrantScope[] = ["BASIC_PROFILE", "LEARNING_NEEDS"];

/** 试听结束后授权默认有效天数 */
const DEFAULT_VALID_UNTIL_DAYS = 7;

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 提取薄弱知识点时回溯的最近摘要条数 */
const WEAK_POINTS_SUMMARY_TAKE = 10;

// ─── 记录类型 ───────────────────────────────────────────────

export type DataGrantRecord = {
  id: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  scopes: DataGrantScope[];
  validFrom: Date;
  validUntil: Date | null;
  revokedAt: Date | null;
  sourceBookingId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TeacherProfileRecord = {
  id: string;
  userId: string;
  displayName: string;
  serviceStatus: TeacherServiceStatus;
};

type ChildRecord = {
  id: string;
  parentProfileId: string;
  name: string;
  grade: string | null;
  schoolName: string | null;
  learningGoals: string[];
  deletedAt: Date | null;
};

type TrialBookingRecord = {
  id: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  status: TrialBookingStatus;
};

type LessonRecord = {
  id: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  status: LessonStatus;
};

type TutoringSummaryRecord = {
  id: string;
  childId: string;
  summary: unknown;
  createdAt: Date;
};

type UserRecord = { id: string };

// ─── 输入类型 ───────────────────────────────────────────────

export interface CreateForBookingInput {
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  bookingId: string;
  scopes?: DataGrantScope[];
  validUntil?: Date;
}

export interface ListStudentsItem {
  childId: string;
  childDisplayName: string;
  subject: Subject;
  nextLessonAt: string | null;
}

// ─── 事务客户端类型（用于在事务内调用 createForBooking） ────

export interface GrantTransactionClient {
  dataGrant: {
    create(args: {
      data: {
        parentProfileId: string;
        childId: string;
        teacherProfileId: string;
        scopes: DataGrantScope[];
        validFrom: Date;
        validUntil: Date | null;
        revokedAt: Date | null;
        sourceBookingId: string | null;
      };
    }): Promise<DataGrantRecord>;
  };
}

// ─── 数据库接口（便于测试 mock） ────────────────────────────

export interface GrantServiceDatabase {
  dataGrant: {
    create(args: {
      data: {
        parentProfileId: string;
        childId: string;
        teacherProfileId: string;
        scopes: DataGrantScope[];
        validFrom: Date;
        validUntil: Date | null;
        revokedAt: Date | null;
        sourceBookingId: string | null;
      };
    }): Promise<DataGrantRecord>;
    findFirst(args: {
      where: {
        teacherProfileId: string;
        childId: string;
        revokedAt: null;
      };
      orderBy: { createdAt: "desc" };
    }): Promise<DataGrantRecord | null>;
    findMany(args: {
      where: { parentProfileId: string } | { teacherProfileId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<DataGrantRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<DataGrantRecord | null>;
    update(args: {
      where: { id: string };
      data: { revokedAt: Date };
    }): Promise<DataGrantRecord>;
  };
  teacherProfile: {
    findUnique(args: { where: { id: string } }): Promise<TeacherProfileRecord | null>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
  };
  trialBooking: {
    findFirst(args: {
      where: {
        childId: string;
        teacherProfileId: string;
        status?: { in: TrialBookingStatus[] };
      };
      orderBy: { createdAt: "desc" };
    }): Promise<TrialBookingRecord | null>;
    findMany(args: {
      where: {
        teacherProfileId: string;
        status?: { in: TrialBookingStatus[] };
      };
      orderBy: { createdAt: "desc" };
    }): Promise<TrialBookingRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<TrialBookingRecord | null>;
  };
  lesson: {
    findFirst(args: {
      where: {
        childId: string;
        teacherProfileId: string;
        status?: { in: LessonStatus[] };
      };
      orderBy: { startsAt: "asc" };
    }): Promise<LessonRecord | null>;
    findMany(args: {
      where: {
        teacherProfileId: string;
        status?: { in: LessonStatus[] };
      };
      orderBy: { startsAt: "asc" };
    }): Promise<LessonRecord[]>;
  };
  tutoringSummary: {
    findMany(args: {
      where: { childId: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<TutoringSummaryRecord[]>;
  };
  user: {
    findUnique(args: { where: { id: string } }): Promise<UserRecord | null>;
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
}

// ─── 服务实现 ──────────────────────────────────────────────

export class GrantService {
  constructor(
    private readonly database: GrantServiceDatabase = prisma as unknown as GrantServiceDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * 家长确认试听时为老师创建 DataGrant。
   * - scopes 默认 [BASIC_PROFILE, LEARNING_NEEDS]
   * - validUntil 默认为试听结束后 7 天（从 TrialBooking.endsAt 计算）
   * - sourceBookingId = bookingId
   * - 若调用方提供 tx，则在事务内创建；否则直接落库（单条 create 已原子）
   */
  async createForBooking(
    input: CreateForBookingInput,
    tx?: GrantTransactionClient,
  ): Promise<DataGrantRecord> {
    const scopes = input.scopes ?? DEFAULT_SCOPES;
    const validFrom = this.clock();

    // 计算 validUntil：优先使用入参，否则取试听 endsAt + 7 天
    let validUntil = input.validUntil;
    if (!validUntil) {
      const booking = await this.database.trialBooking.findUnique({
        where: { id: input.bookingId },
      });
      if (!booking) {
        throw new AppError("NOT_FOUND", 404, "Trial booking not found");
      }
      validUntil = new Date(booking.endsAt.getTime() + DEFAULT_VALID_UNTIL_DAYS * DAY_MS);
    }

    const data = {
      parentProfileId: input.parentProfileId,
      childId: input.childId,
      teacherProfileId: input.teacherProfileId,
      scopes,
      validFrom,
      validUntil,
      revokedAt: null,
      sourceBookingId: input.bookingId,
    };

    if (tx) {
      return tx.dataGrant.create({ data });
    }
    return this.database.dataGrant.create({ data });
  }

  /**
   * 老师读取学生摘要（最小范围）。
   * 同时校验：老师 ACTIVE + 有有效服务关系 + grant 未撤销未过期 + 包含 LEARNING_NEEDS scope。
   * 返回的 DTO 严格排除 parentPhone、rawAssessment、MBTI、学校名称等敏感字段。
   */
  async readStudentSummary(
    teacherProfileId: string,
    childId: string,
  ): Promise<StudentSummaryDto> {
    // 综合校验：老师 ACTIVE、服务关系、grant 有效、scope 包含 LEARNING_NEEDS
    await this.assertValid(teacherProfileId, childId, "LEARNING_NEEDS");

    const child = await this.database.child.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt) {
      // 理论上 assertValid 已校验服务关系，但 child 可能被软删；统一返回 NOT_FOUND
      throw new AppError("NOT_FOUND", 404, "Child not found");
    }

    const weakKnowledgePoints = await this.extractWeakKnowledgePoints(childId);
    // teachingPreferences：当前 schema 中 Child 没有独立 profile body 字段，
    // 暂返回空数组。后续可在 LearningProfileVersion.snapshot 中扩展。
    const teachingPreferences: string[] = [];

    return {
      childId,
      displayName: child.name,
      grade: child.grade,
      learningGoals: child.learningGoals,
      weakKnowledgePoints,
      teachingPreferences,
    };
  }

  /**
   * 老师工作台：列出当前有有效服务关系的学生。
   * 有效服务关系 = 有未完成 Lesson（SCHEDULED / IN_PROGRESS）或最近 COMPLETED TrialBooking。
   */
  async listStudents(teacherProfileId: string): Promise<ListStudentsItem[]> {
    const [activeLessons, completedTrials] = await Promise.all([
      this.database.lesson.findMany({
        where: {
          teacherProfileId,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        orderBy: { startsAt: "asc" },
      }),
      this.database.trialBooking.findMany({
        where: {
          teacherProfileId,
          status: { in: ["COMPLETED"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 合并 childId -> { subject, nextLessonAt }
    const childMap = new Map<string, { subject: Subject; nextLessonAt: Date | null }>();

    // 先放 upcoming lessons（更具体的未来课程）
    for (const lesson of activeLessons) {
      const existing = childMap.get(lesson.childId);
      if (!existing) {
        childMap.set(lesson.childId, {
          subject: lesson.subject,
          nextLessonAt: lesson.startsAt,
        });
      } else if (existing.nextLessonAt && lesson.startsAt < existing.nextLessonAt) {
        existing.nextLessonAt = lesson.startsAt;
        existing.subject = lesson.subject;
      }
    }

    // 再放 completed trials（仅当 child 不在 lessons 列表中时）
    for (const trial of completedTrials) {
      if (!childMap.has(trial.childId)) {
        childMap.set(trial.childId, {
          subject: trial.subject,
          nextLessonAt: null,
        });
      }
    }

    const items: ListStudentsItem[] = [];
    for (const [childId, info] of childMap) {
      const child = await this.database.child.findUnique({ where: { id: childId } });
      if (!child || child.deletedAt) continue;
      items.push({
        childId,
        childDisplayName: child.name,
        subject: info.subject,
        nextLessonAt: info.nextLessonAt ? info.nextLessonAt.toISOString() : null,
      });
    }
    return items;
  }

  /**
   * 家长撤销授权。设置 revokedAt = now，立即失效。
   * 校验归属权，并向老师发送站内通知。
   */
  async revoke(parentProfileId: string, grantId: string): Promise<DataGrantRecord> {
    const grant = await this.database.dataGrant.findUnique({ where: { id: grantId } });
    if (!grant) {
      throw new AppError("NOT_FOUND", 404, "Data grant not found");
    }
    if (grant.parentProfileId !== parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "You cannot revoke this grant");
    }
    if (grant.revokedAt) {
      throw new AppError("RESOURCE_CONFLICT", 409, "Grant is already revoked");
    }

    const now = this.clock();
    const updated = await this.database.dataGrant.update({
      where: { id: grantId },
      data: { revokedAt: now },
    });

    // 通知老师：授权已被撤销（不阻塞主流程）
    await this.sendRevokeNotification(grant);

    return updated;
  }

  /**
   * 家长查看自己发出的所有授权（按创建时间倒序）。
   */
  async listByParent(parentProfileId: string): Promise<DataGrantSummary[]> {
    const grants = await this.database.dataGrant.findMany({
      where: { parentProfileId },
      orderBy: { createdAt: "desc" },
    });
    return this.toSummaries(grants);
  }

  /**
   * 老师查看自己收到的所有授权（按创建时间倒序）。
   */
  async listByTeacher(teacherProfileId: string): Promise<DataGrantSummary[]> {
    const grants = await this.database.dataGrant.findMany({
      where: { teacherProfileId },
      orderBy: { createdAt: "desc" },
    });
    return this.toSummaries(grants);
  }

  /**
   * 内部校验：grant 有效且包含 requiredScope。
   * 任何一项不满足都抛 FORBIDDEN。
   * 校验项：
   * 1. 老师存在且 serviceStatus === ACTIVE
   * 2. 老师与该 child 有有效服务关系（未完成 Lesson 或最近 COMPLETED TrialBooking）
   * 3. 存在未撤销、未过期的 grant
   * 4. grant.scopes 包含 requiredScope
   */
  async assertValid(
    teacherProfileId: string,
    childId: string,
    requiredScope: DataGrantScope,
  ): Promise<void> {
    // 1. 老师存在且 ACTIVE
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: teacherProfileId },
    });
    if (!teacher) {
      throw new AppError("FORBIDDEN", 403, "Teacher not found");
    }
    if (teacher.serviceStatus !== "ACTIVE") {
      throw new AppError("FORBIDDEN", 403, "Teacher is not active");
    }

    // 2. 有效服务关系
    const hasService = await this.hasServiceRelationship(teacherProfileId, childId);
    if (!hasService) {
      throw new AppError("FORBIDDEN", 403, "No active service relationship with this child");
    }

    // 3. 存在有效 grant
    const grant = await this.database.dataGrant.findFirst({
      where: { teacherProfileId, childId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!grant) {
      throw new AppError("FORBIDDEN", 403, "No active data grant for this child");
    }

    // revokedAt 已在 where 中过滤，此处再次防御性检查
    if (grant.revokedAt) {
      throw new AppError("FORBIDDEN", 403, "Data grant has been revoked");
    }

    // 过期校验
    const now = this.clock();
    if (grant.validUntil && grant.validUntil < now) {
      throw new AppError("FORBIDDEN", 403, "Data grant has expired");
    }

    // 4. scope 校验
    if (!grant.scopes.includes(requiredScope)) {
      throw new AppError("FORBIDDEN", 403, `Grant does not include scope: ${requiredScope}`);
    }
  }

  // ─── 内部辅助方法 ──────────────────────────────────────

  /**
   * 校验老师与孩子是否存在有效服务关系：
   * - 有未完成 Lesson（SCHEDULED / IN_PROGRESS），或
   * - 有最近 COMPLETED TrialBooking
   */
  private async hasServiceRelationship(
    teacherProfileId: string,
    childId: string,
  ): Promise<boolean> {
    const [lesson, trial] = await Promise.all([
      this.database.lesson.findFirst({
        where: {
          childId,
          teacherProfileId,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        orderBy: { startsAt: "asc" },
      }),
      this.database.trialBooking.findFirst({
        where: {
          childId,
          teacherProfileId,
          status: { in: ["COMPLETED"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return lesson !== null || trial !== null;
  }

  /**
   * 从孩子最近的 TutoringSummary 中提取薄弱知识点。
   * TutoringSummary.summary 的 JSON 结构包含 knowledgePoints 数组，
   * 每项 { name: string; performance: "STRONG" | "MIXED" | "WEAK" }，
   * 只保留 performance === "WEAK" 的 name。
   */
  private async extractWeakKnowledgePoints(childId: string): Promise<string[]> {
    const summaries = await this.database.tutoringSummary.findMany({
      where: { childId },
      orderBy: { createdAt: "desc" },
      take: WEAK_POINTS_SUMMARY_TAKE,
    });
    const points = new Set<string>();
    for (const record of summaries) {
      const summary = asRecord(record.summary);
      const knowledgePoints = Array.isArray(summary.knowledgePoints)
        ? summary.knowledgePoints
        : [];
      for (const point of knowledgePoints) {
        const pointRecord = asRecord(point);
        const name = typeof pointRecord.name === "string" ? pointRecord.name : null;
        const performance =
          typeof pointRecord.performance === "string" ? pointRecord.performance : null;
        if (name && performance === "WEAK") {
          points.add(name);
        }
      }
    }
    return Array.from(points);
  }

  /**
   * 把 DataGrantRecord 列表投影为 DataGrantSummary DTO 列表。
   * 需要批量查询 teacher displayName。
   */
  private async toSummaries(grants: DataGrantRecord[]): Promise<DataGrantSummary[]> {
    if (grants.length === 0) return [];

    const teacherIds = [...new Set(grants.map((g) => g.teacherProfileId))];
    const teachers = await Promise.all(
      teacherIds.map((id) => this.database.teacherProfile.findUnique({ where: { id } })),
    );
    const teacherMap = new Map(
      teachers
        .filter((t): t is TeacherProfileRecord => t !== null)
        .map((t) => [t.id, t.displayName]),
    );

    return grants.map((grant) => this.toSummary(grant, teacherMap.get(grant.teacherProfileId) ?? ""));
  }

  private toSummary(grant: DataGrantRecord, teacherDisplayName: string): DataGrantSummary {
    return {
      id: grant.id,
      childId: grant.childId,
      teacherProfileId: grant.teacherProfileId,
      teacherDisplayName,
      scopes: grant.scopes,
      validFrom: grant.validFrom.toISOString(),
      validUntil: grant.validUntil ? grant.validUntil.toISOString() : null,
      revokedAt: grant.revokedAt ? grant.revokedAt.toISOString() : null,
      sourceBookingId: grant.sourceBookingId,
    };
  }

  /**
   * 发送撤销通知给老师（幂等）。
   */
  private async sendRevokeNotification(grant: DataGrantRecord): Promise<void> {
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: grant.teacherProfileId },
    });
    if (!teacher) return;

    const dedupeKey = `grant-revoke:${grant.id}:${this.clock().getTime()}`;
    await this.database.notification.upsert({
      where: { dedupeKey },
      create: {
        userId: teacher.userId,
        type: "SYSTEM",
        dedupeKey,
        body: {
          action: "GRANT_REVOKED",
          grantId: grant.id,
          childId: grant.childId,
        },
        targetRoute: null,
        targetParams: null,
      },
      update: {},
    });
  }
}

// ─── 工具函数 ─────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

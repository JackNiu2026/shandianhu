/**
 * V2.3 Task 10 老师工作台待办聚合服务
 *
 * 聚合当前老师的工作台数据：待处理试听、即将到来的课程、待反馈课程、活跃学生。
 * 只返回该老师自己的数据；所有 teacherDisplayName 由 TeacherProfile.displayName 填充。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type {
  Subject,
  TeachingMode,
  TeacherServiceStatus,
  TrialBookingStatus,
  LessonStatus,
} from "@prisma/client";
import type {
  TeacherDashboard,
  TrialBookingSummary,
  LessonSummary,
} from "@lightning-tiger/shared/api";

// ─── 常量 ──────────────────────────────────────────────────

/** 待处理试听状态：家长已发起但尚未进入终态 */
const PENDING_TRIAL_STATUSES: TrialBookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "RESCHEDULE_PROPOSED",
];

/** 即将到来的课程状态 */
const UPCOMING_LESSON_STATUSES: LessonStatus[] = ["SCHEDULED", "IN_PROGRESS"];

/** 工作台最多展示的即将到来课程条数 */
const UPCOMING_LESSONS_LIMIT = 10;

// ─── 记录类型 ───────────────────────────────────────────────

export type TeacherProfileRecord = {
  id: string;
  userId: string;
  displayName: string;
  serviceStatus: TeacherServiceStatus;
};

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
};

export type LessonRecord = {
  id: string;
  childId: string;
  teacherProfileId: string;
  subject: Subject;
  startsAt: Date;
  endsAt: Date;
  status: LessonStatus;
  mode: TeachingMode | null;
  completedAt: Date | null;
};

export type TeacherFeedbackRecord = {
  id: string;
  lessonId: string;
  isCurrent: boolean;
};

export type ParentReviewRecord = {
  id: string;
  lessonId: string;
};

type ChildRecord = {
  id: string;
  name: string;
  deletedAt: Date | null;
};

// ─── 数据库接口（便于测试 mock） ────────────────────────────

export interface DashboardDatabase {
  teacherProfile: {
    findUnique(args: {
      where: { id: string };
    }): Promise<TeacherProfileRecord | null>;
  };
  trialBooking: {
    findMany(args: {
      where: {
        teacherProfileId: string;
        status: { in: TrialBookingStatus[] };
      };
      orderBy: { createdAt: "asc" };
    }): Promise<TrialBookingRecord[]>;
  };
  lesson: {
    findMany(args: {
      where: {
        teacherProfileId: string;
        status: { in: LessonStatus[] };
      };
      orderBy: { startsAt: "asc" };
      take?: number;
    }): Promise<LessonRecord[]>;
  };
  teacherFeedback: {
    findMany(args: {
      where: { lessonId: { in: string[] }; isCurrent: boolean };
    }): Promise<TeacherFeedbackRecord[]>;
  };
  parentReview: {
    findMany(args: {
      where: { lessonId: { in: string[] } };
    }): Promise<ParentReviewRecord[]>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
  };
}

// ─── 服务 ───────────────────────────────────────────────────

export class DashboardService {
  constructor(
    private readonly database: DashboardDatabase = prisma as unknown as DashboardDatabase,
  ) {}

  /**
   * 加载老师工作台聚合数据。
   * - 只返回该老师的数据
   * - pendingTrials: REQUESTED + ACCEPTED + RESCHEDULE_PROPOSED，按 createdAt 升序
   * - upcomingLessons: SCHEDULED + IN_PROGRESS，按 startsAt 升序，最多 10 条
   * - lessonsAwaitingFeedback: COMPLETED 但无 current feedback 的课程
   * - activeStudents: 有未来课程的孩子，按 childId 去重
   */
  async load(teacherProfileId: string): Promise<TeacherDashboard> {
    // 校验老师存在
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: teacherProfileId },
    });
    if (!teacher) {
      throw new AppError("NOT_FOUND", 404, "Teacher profile not found");
    }

    // 并行拉取：待处理试听、即将到来的课程、已完成课程（用于筛选待反馈）
    const [pendingTrials, upcomingLessons, completedLessons] = await Promise.all([
      this.database.trialBooking.findMany({
        where: {
          teacherProfileId,
          status: { in: PENDING_TRIAL_STATUSES },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.database.lesson.findMany({
        where: {
          teacherProfileId,
          status: { in: UPCOMING_LESSON_STATUSES },
        },
        orderBy: { startsAt: "asc" },
        take: UPCOMING_LESSONS_LIMIT,
      }),
      this.database.lesson.findMany({
        where: {
          teacherProfileId,
          status: { in: ["COMPLETED"] },
        },
        orderBy: { startsAt: "asc" },
      }),
    ]);

    // 拉取已完成课程的 current feedback 和 review，用于筛选和填充 hasFeedback/hasReview
    const completedLessonIds = completedLessons.map((l) => l.id);
    let currentFeedbacks: TeacherFeedbackRecord[] = [];
    let completedReviews: ParentReviewRecord[] = [];
    if (completedLessonIds.length > 0) {
      [currentFeedbacks, completedReviews] = await Promise.all([
        this.database.teacherFeedback.findMany({
          where: { lessonId: { in: completedLessonIds }, isCurrent: true },
        }),
        this.database.parentReview.findMany({
          where: { lessonId: { in: completedLessonIds } },
        }),
      ]);
    }

    const lessonsWithCurrentFeedback = new Set(currentFeedbacks.map((f) => f.lessonId));
    const lessonsWithReview = new Set(completedReviews.map((r) => r.lessonId));

    // 待反馈课程：COMPLETED 且无 current feedback
    const lessonsAwaitingFeedback = completedLessons.filter(
      (l) => !lessonsWithCurrentFeedback.has(l.id),
    );

    // 活跃学生：从即将到来的课程中按 childId 去重，取最早一节的科目和时间
    const activeStudents = await this.collectActiveStudents(upcomingLessons);

    return {
      pendingTrials: pendingTrials.map((b) =>
        this.toTrialSummary(b, teacher.displayName),
      ),
      upcomingLessons: upcomingLessons.map((l) =>
        this.toLessonSummary(l, teacher.displayName, false, false),
      ),
      lessonsAwaitingFeedback: lessonsAwaitingFeedback.map((l) =>
        this.toLessonSummary(
          l,
          teacher.displayName,
          false,
          lessonsWithReview.has(l.id),
        ),
      ),
      activeStudents,
      serviceStatus: teacher.serviceStatus,
    };
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /**
   * 从即将到来的课程中收集活跃学生，按 childId 去重。
   * 每个孩子取最早一节未来课程的科目和开始时间。
   */
  private async collectActiveStudents(
    upcomingLessons: LessonRecord[],
  ): Promise<TeacherDashboard["activeStudents"]> {
    // childId -> { subject, nextLessonAt }
    const childMap = new Map<string, { subject: Subject; nextLessonAt: Date }>();
    for (const lesson of upcomingLessons) {
      const existing = childMap.get(lesson.childId);
      if (!existing) {
        childMap.set(lesson.childId, {
          subject: lesson.subject,
          nextLessonAt: lesson.startsAt,
        });
      } else if (lesson.startsAt < existing.nextLessonAt) {
        existing.nextLessonAt = lesson.startsAt;
        existing.subject = lesson.subject;
      }
    }

    const items: TeacherDashboard["activeStudents"] = [];
    for (const [childId, info] of childMap) {
      const child = await this.database.child.findUnique({ where: { id: childId } });
      // 软删的孩子跳过
      if (!child || child.deletedAt) continue;
      items.push({
        childId,
        childDisplayName: child.name,
        subject: info.subject,
        nextLessonAt: info.nextLessonAt.toISOString(),
      });
    }
    return items;
  }

  /** 把 TrialBooking 记录转为对外 DTO，teacherDisplayName 由调用方填充。 */
  private toTrialSummary(
    booking: TrialBookingRecord,
    teacherDisplayName: string,
  ): TrialBookingSummary {
    return {
      id: booking.id,
      idempotencyKey: booking.idempotencyKey,
      parentProfileId: booking.parentProfileId,
      childId: booking.childId,
      teacherProfileId: booking.teacherProfileId,
      teacherDisplayName,
      subject: booking.subject,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      mode: booking.mode,
      parentNote: booking.parentNote,
      version: booking.version,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  /** 把 Lesson 记录转为对外 DTO，teacherDisplayName 由调用方填充。 */
  private toLessonSummary(
    lesson: LessonRecord,
    teacherDisplayName: string,
    hasFeedback: boolean,
    hasReview: boolean,
  ): LessonSummary {
    return {
      id: lesson.id,
      childId: lesson.childId,
      teacherProfileId: lesson.teacherProfileId,
      teacherDisplayName,
      subject: lesson.subject,
      startsAt: lesson.startsAt.toISOString(),
      endsAt: lesson.endsAt.toISOString(),
      status: lesson.status,
      mode: lesson.mode,
      hasFeedback,
      hasReview,
      completedAt: lesson.completedAt ? lesson.completedAt.toISOString() : null,
    };
  }
}

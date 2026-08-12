/**
 * V2.3 Task 11 课程完成与结构化老师反馈
 *
 * 职责：
 * - submit：老师为已完成课程提交结构化反馈（版本化、幂等）
 * - getByLesson：按课程查看当前反馈（老师看完整、家长看公开字段）
 * - listByLesson：列出课程的所有反馈版本（仅老师）
 *
 * 安全与一致性：
 * - 反馈是老师署名、版本化服务记录，家长不能直接编辑或单独删除
 * - 校验 lesson 属于该老师且 status=COMPLETED
 * - 幂等：operationKey 重复提交返回同一条记录
 * - 修改必须创建修订版本（sequence+1），旧版本 isCurrent=false
 * - 公开字段写 LearningEvidence（source=TEACHER_FEEDBACK），privateTeacherNote 不进入画像
 * - 重复消费不重复 evidence
 * - 事务提交后投递 PROFILE_GENERATION + REPORT_GENERATION job
 * - 发通知给家长
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type { TeacherFeedbackInput } from "./feedback-schema";
import type {
  FeedbackPerformance,
  TeacherFeedbackDto,
} from "@lightning-tiger/shared/api";

// ─── 常量 ──────────────────────────────────────────────────

/** Prisma 已知错误码：唯一约束违反 */
const PRISMA_UNIQUE_VIOLATION = "P2002";
/** EvidenceSource 枚举值：老师反馈 */
const EVIDENCE_SOURCE_TEACHER_FEEDBACK = "TEACHER_FEEDBACK";

// ─── 记录类型 ───────────────────────────────────────────────

export type LessonRecord = {
  id: string;
  childId: string;
  teacherProfileId: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  completedAt: Date | null;
};

export type TeacherFeedbackRecord = {
  id: string;
  lessonId: string;
  sequence: number;
  lessonContent: string[];
  performance: FeedbackPerformance;
  difficulties: string[];
  suggestions: string[];
  privateTeacherNote: string | null;
  isCurrent: boolean;
  supersedesId: string | null;
  createdByTeacherProfileId: string;
  correctionReason: string | null;
  createdAt: Date;
};

export type LearningEvidenceRecord = {
  id: string;
  childId: string;
  source: string;
  sourceId: string;
  observedAt: Date;
  payload: unknown;
  revokedAt: Date | null;
  createdAt: Date;
};

type ParentProfileRecord = {
  id: string;
  userId: string;
  displayName: string | null;
};

type ChildRecord = {
  id: string;
  parentProfileId: string;
};

// ─── 数据库接口（便于测试 mock） ────────────────────────────

export interface FeedbackDatabase {
  lesson: {
    findUnique(args: { where: { id: string } }): Promise<LessonRecord | null>;
  };
  teacherFeedback: {
    findFirst(args: {
      where: { lessonId: string; isCurrent?: boolean };
      orderBy?: { createdAt: "desc" };
    }): Promise<TeacherFeedbackRecord | null>;
    findMany(args: {
      where: { lessonId: string };
      orderBy: { sequence: "asc" | "desc" };
    }): Promise<TeacherFeedbackRecord[]>;
    create(args: {
      data: {
        lessonId: string;
        sequence: number;
        lessonContent: string[];
        performance: FeedbackPerformance;
        difficulties: string[];
        suggestions: string[];
        privateTeacherNote: string | null;
        isCurrent: boolean;
        supersedesId: string | null;
        createdByTeacherProfileId: string;
        correctionReason: string | null;
      };
    }): Promise<TeacherFeedbackRecord>;
    update(args: {
      where: { id: string };
      data: { isCurrent: boolean };
    }): Promise<TeacherFeedbackRecord>;
  };
  learningEvidence: {
    findFirst(args: {
      where: { childId: string; source: string; sourceId: string };
    }): Promise<LearningEvidenceRecord | null>;
    create(args: {
      data: {
        childId: string;
        source: string;
        sourceId: string;
        observedAt: Date;
        payload: unknown;
      };
    }): Promise<LearningEvidenceRecord>;
    update(args: {
      where: { id: string };
      data: { revokedAt: Date };
    }): Promise<LearningEvidenceRecord>;
  };
  parentProfile: {
    findUnique(args: { where: { id: string } }): Promise<ParentProfileRecord | null>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
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
  $transaction<T>(callback: (tx: FeedbackDatabase) => Promise<T>): Promise<T>;
}

// ─── Job 投递接口 ──────────────────────────────────────────

export interface FeedbackJobEnqueuer {
  enqueue(
    type: "PROFILE_GENERATION" | "REPORT_GENERATION",
    dedupeKey: string,
    payload: unknown,
  ): Promise<unknown>;
}

// ─── 工具 ──────────────────────────────────────────────────

function isPrismaUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ─── 服务 ───────────────────────────────────────────────────

export class FeedbackService {
  constructor(
    private readonly database: FeedbackDatabase = prisma as unknown as FeedbackDatabase,
    private readonly jobEnqueuer?: FeedbackJobEnqueuer,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ─── submit ──────────────────────────────────────────────

  /**
   * 老师提交课程反馈。
   * - 校验 lesson 属于该老师且 status=COMPLETED
   * - 幂等：operationKey 重复提交返回同一条
   * - 首次提交：创建 TeacherFeedback(sequence=1, isCurrent=true)
   * - 修改必须创建修订版本（sequence+1），旧版本 isCurrent=false
   * - correctionReason 必填（修订时）
   * - 公开字段写 LearningEvidence（source=TEACHER_FEEDBACK）
   * - privateTeacherNote 不进入画像
   * - 事务提交后投递 PROFILE_GENERATION + REPORT_GENERATION job
   * - 发通知给家长
   */
  async submit(
    teacherProfileId: string,
    lessonId: string,
    operationKey: string,
    input: TeacherFeedbackInput,
    correctionReason?: string,
  ): Promise<TeacherFeedbackDto> {
    // 校验 lesson 属于该老师且 status=COMPLETED
    const lesson = await this.database.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new AppError("NOT_FOUND", 404, "Lesson not found");
    }
    if (lesson.teacherProfileId !== teacherProfileId) {
      throw new AppError("FORBIDDEN", 403, "Only the assigned teacher can submit feedback");
    }
    if (lesson.status !== "COMPLETED") {
      throw new AppError("RESOURCE_CONFLICT", 409, "Lesson is not completed");
    }

    // 幂等检查：通过 LearningEvidence(source=TEACHER_FEEDBACK, sourceId=operationKey) 判断
    const existingEvidence = await this.database.learningEvidence.findFirst({
      where: {
        childId: lesson.childId,
        source: EVIDENCE_SOURCE_TEACHER_FEEDBACK,
        sourceId: operationKey,
      },
    });
    if (existingEvidence) {
      // 幂等返回：从 evidence payload 中取出 feedbackId，返回已有反馈
      const payload = asRecord(existingEvidence.payload);
      const feedbackId = typeof payload.feedbackId === "string" ? payload.feedbackId : null;
      if (feedbackId) {
        const existingFeedback = await this.database.teacherFeedback.findFirst({
          where: { lessonId, isCurrent: true },
        });
        if (existingFeedback && existingFeedback.id === feedbackId) {
          return this.toDto(existingFeedback, { includePrivateNote: true });
        }
      }
    }

    // 检查是否有当前反馈（决定是首次提交还是修订）
    const currentFeedback = await this.database.teacherFeedback.findFirst({
      where: { lessonId, isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    const isRevision = currentFeedback !== null;

    // 修订时 correctionReason 必填
    if (isRevision && !correctionReason) {
      throw new AppError("VALIDATION_ERROR", 400, "correctionReason is required for revision");
    }

    const sequence = isRevision ? currentFeedback!.sequence + 1 : 1;
    const now = this.clock();

    // 预加载家长信息（用于通知）
    const child = await this.database.child.findUnique({ where: { id: lesson.childId } });
    const parent = child
      ? await this.database.parentProfile.findUnique({ where: { id: child.parentProfileId } })
      : null;

    // 事务内创建反馈 + evidence + 通知
    const feedback = await this.database.$transaction(async (tx) => {
      // 如果是修订，先将旧版本标记为非当前
      if (isRevision) {
        await tx.teacherFeedback.update({
          where: { id: currentFeedback!.id },
          data: { isCurrent: false },
        });
      }

      // 创建新反馈版本
      const created = await tx.teacherFeedback.create({
        data: {
          lessonId,
          sequence,
          lessonContent: input.lessonContent,
          performance: input.performance,
          difficulties: input.difficulties,
          suggestions: input.suggestions,
          privateTeacherNote: input.privateTeacherNote ?? null,
          isCurrent: true,
          supersedesId: isRevision ? currentFeedback!.id : null,
          createdByTeacherProfileId: teacherProfileId,
          correctionReason: isRevision ? correctionReason ?? null : null,
        },
      });

      // 写 LearningEvidence（公开字段，不含 privateTeacherNote）
      // sourceId=operationKey 确保幂等：重复消费不重复 evidence
      try {
        await tx.learningEvidence.create({
          data: {
            childId: lesson.childId,
            source: EVIDENCE_SOURCE_TEACHER_FEEDBACK,
            sourceId: operationKey,
            observedAt: now,
            payload: {
              feedbackId: created.id,
              lessonId,
              teacherProfileId,
              sequence: created.sequence,
              lessonContent: created.lessonContent,
              performance: created.performance,
              difficulties: created.difficulties,
              suggestions: created.suggestions,
              createdAt: created.createdAt.toISOString(),
            },
          },
        });
      } catch (error) {
        // 并发幂等：另一个事务先创建了相同 (childId, source, sourceId) 的 evidence
        if (isPrismaUniqueViolation(error)) {
          throw new AppError("RESOURCE_CONFLICT", 409, "Feedback already exists for this operation");
        }
        throw error;
      }

      // 发通知给家长
      if (parent) {
        await tx.notification.upsert({
          where: {
            dedupeKey: `feedback-received:${lessonId}:${created.id}`,
          },
          create: {
            userId: parent.userId,
            type: "FEEDBACK_RECEIVED",
            dedupeKey: `feedback-received:${lessonId}:${created.id}`,
            body: {
              lessonId,
              feedbackId: created.id,
              childId: lesson.childId,
              teacherProfileId,
              sequence: created.sequence,
            },
            targetRoute: null,
            targetParams: { lessonId },
          },
          update: {},
        });
      }

      return created;
    });

    // 事务提交后投递 PROFILE_GENERATION + REPORT_GENERATION job
    if (this.jobEnqueuer) {
      await this.jobEnqueuer.enqueue(
        "PROFILE_GENERATION",
        `profile-gen:${lesson.childId}:${feedback.id}`,
        { childId: lesson.childId, feedbackId: feedback.id },
      );
      await this.jobEnqueuer.enqueue(
        "REPORT_GENERATION",
        `report-gen:${lesson.childId}:${feedback.id}`,
        { childId: lesson.childId, feedbackId: feedback.id },
      );
    }

    return this.toDto(feedback, { includePrivateNote: true });
  }

  // ─── getByLesson ─────────────────────────────────────────

  /**
   * 按课程查看当前反馈。
   * - 老师可看完整反馈（含 privateTeacherNote）
   * - 家长只看公开字段（不含 privateTeacherNote）
   */
  async getByLesson(lessonId: string, viewerId: string): Promise<TeacherFeedbackDto> {
    const lesson = await this.database.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new AppError("NOT_FOUND", 404, "Lesson not found");
    }

    // 判断 viewer 是老师还是家长
    const isTeacher = lesson.teacherProfileId === viewerId;
    let isParent = false;
    if (!isTeacher) {
      const child = await this.database.child.findUnique({ where: { id: lesson.childId } });
      isParent = child !== null && child.parentProfileId === viewerId;
    }
    if (!isTeacher && !isParent) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this lesson feedback");
    }

    const feedback = await this.database.teacherFeedback.findFirst({
      where: { lessonId, isCurrent: true },
      orderBy: { createdAt: "desc" },
    });
    if (!feedback) {
      throw new AppError("NOT_FOUND", 404, "No feedback found for this lesson");
    }

    // 家长看不到 privateTeacherNote
    return this.toDto(feedback, { includePrivateNote: isTeacher });
  }

  // ─── listByLesson ────────────────────────────────────────

  /**
   * 列出课程的所有反馈版本（仅老师可用）。
   */
  async listByLesson(lessonId: string): Promise<TeacherFeedbackDto[]> {
    const feedbacks = await this.database.teacherFeedback.findMany({
      where: { lessonId },
      orderBy: { sequence: "desc" },
    });
    return feedbacks.map((f) => this.toDto(f, { includePrivateNote: true }));
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /** 把记录转为对外 DTO。includePrivateNote 控制是否包含 privateTeacherNote。 */
  private toDto(
    feedback: TeacherFeedbackRecord,
    options: { includePrivateNote?: boolean } = {},
  ): TeacherFeedbackDto {
    return {
      id: feedback.id,
      lessonId: feedback.lessonId,
      sequence: feedback.sequence,
      lessonContent: feedback.lessonContent,
      performance: feedback.performance,
      difficulties: feedback.difficulties,
      suggestions: feedback.suggestions,
      privateTeacherNote: options.includePrivateNote ? feedback.privateTeacherNote : null,
      isCurrent: feedback.isCurrent,
      supersedesId: feedback.supersedesId,
      correctionReason: feedback.correctionReason,
      createdByTeacherProfileId: feedback.createdByTeacherProfileId,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}

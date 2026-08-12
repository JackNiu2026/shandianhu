/**
 * V2.3 Task 12 与已完成课程绑定的真实家长评价
 *
 * 职责：
 * - create：家长为已完成课程提交评价（绑定真实课程，不可伪造）
 * - getByLesson：按课程查看评价
 * - listByTeacher：老师的公开评价列表
 * - listByParent：家长的评价历史
 *
 * 安全与一致性：
 * - 评价必须绑定真实已完成课程（lesson.status=COMPLETED）
 * - 校验 lesson 属于该家长的 child
 * - 唯一性：每个 lesson 只有一个 review
 * - author 从会话和课程关系推导（parentProfile.displayName 或 "家长"）
 * - authorDisplayName 使用脱敏称呼
 * - 评价不可由管理员伪造
 * - rating 1-5, content 10-1000 字
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type {
  ParentReviewDto,
  ParentReviewPublic,
} from "@lightning-tiger/shared/api";

// ─── 常量 ──────────────────────────────────────────────────

/** Prisma 已知错误码：唯一约束违反 */
const PRISMA_UNIQUE_VIOLATION = "P2002";
/** 评价内容最小长度 */
const MIN_CONTENT_LENGTH = 10;
/** 评价内容最大长度 */
const MAX_CONTENT_LENGTH = 1000;
/** 评分最小值 */
const MIN_RATING = 1;
/** 评分最大值 */
const MAX_RATING = 5;

// ─── 记录类型 ───────────────────────────────────────────────

export type ReviewLessonRecord = {
  id: string;
  childId: string;
  teacherProfileId: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
};

export type ParentReviewRecord = {
  id: string;
  lessonId: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  rating: number;
  content: string;
  authorDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
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

type TeacherProfileRecord = {
  id: string;
  userId: string;
};

// ─── 输入类型 ───────────────────────────────────────────────

export interface CreateReviewInput {
  rating: number;
  content: string;
}

// ─── 数据库接口（便于测试 mock） ────────────────────────────

export interface ReviewDatabase {
  lesson: {
    findUnique(args: { where: { id: string } }): Promise<ReviewLessonRecord | null>;
  };
  parentReview: {
    findUnique(args: { where: { lessonId: string } }): Promise<ParentReviewRecord | null>;
    findMany(args: {
      where: { teacherProfileId?: string; parentProfileId?: string };
      orderBy: { createdAt: "desc" };
      take?: number;
    }): Promise<ParentReviewRecord[]>;
    create(args: {
      data: {
        lessonId: string;
        parentProfileId: string;
        childId: string;
        teacherProfileId: string;
        rating: number;
        content: string;
        authorDisplayName: string;
      };
    }): Promise<ParentReviewRecord>;
  };
  parentProfile: {
    findUnique(args: { where: { id: string } }): Promise<ParentProfileRecord | null>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
  };
  teacherProfile: {
    findUnique(args: { where: { id: string } }): Promise<TeacherProfileRecord | null>;
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

// ─── 工具 ──────────────────────────────────────────────────

function isPrismaUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION;
}

/**
 * 生成脱敏称呼。
 * - 有 displayName：取首字 + "家长"（如 "张三" → "张家长"）
 * - 无 displayName：返回 "家长"
 */
function buildAuthorDisplayName(displayName: string | null): string {
  if (!displayName || displayName.length === 0) {
    return "家长";
  }
  return `${displayName.charAt(0)}家长`;
}

// ─── 服务 ───────────────────────────────────────────────────

export class ReviewService {
  constructor(
    private readonly database: ReviewDatabase = prisma as unknown as ReviewDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ─── create ──────────────────────────────────────────────

  /**
   * 家长提交课程评价。
   * - 校验 lesson 属于该家长的 child 且 status=COMPLETED
   * - 校验 rating 1-5, content 10-1000 字
   * - 唯一性：每个 lesson 只有一个 review
   * - author 从会话和课程关系推导（parentProfile.displayName 或 "家长"）
   * - authorDisplayName 使用脱敏称呼
   */
  async create(
    parentProfileId: string,
    lessonId: string,
    input: CreateReviewInput,
  ): Promise<ParentReviewDto> {
    // 校验 lesson 存在
    const lesson = await this.database.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new AppError("NOT_FOUND", 404, "Lesson not found");
    }

    // 校验 lesson 属于该家长的 child
    const child = await this.database.child.findUnique({ where: { id: lesson.childId } });
    if (!child || child.parentProfileId !== parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "You cannot review a lesson that does not belong to your child");
    }

    // 校验 lesson 已完成
    if (lesson.status !== "COMPLETED") {
      throw new AppError("RESOURCE_CONFLICT", 409, "Lesson is not completed");
    }

    if (!Number.isInteger(input.rating) || input.rating < MIN_RATING || input.rating > MAX_RATING) {
      throw new AppError("VALIDATION_ERROR", 400, "rating must be an integer between 1 and 5");
    }
    if (input.content.length < MIN_CONTENT_LENGTH || input.content.length > MAX_CONTENT_LENGTH) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        `content must be between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH} characters`,
      );
    }

    // 从 parentProfile 推导 author（不从 client input 获取）
    const parent = await this.database.parentProfile.findUnique({
      where: { id: parentProfileId },
    });
    const authorDisplayName = buildAuthorDisplayName(parent?.displayName ?? null);

    // 创建评价（唯一约束保护：每个 lesson 只有一个 review）
    let review: ParentReviewRecord;
    try {
      review = await this.database.parentReview.create({
        data: {
          lessonId,
          parentProfileId,
          childId: lesson.childId,
          teacherProfileId: lesson.teacherProfileId,
          rating: input.rating,
          content: input.content,
          authorDisplayName,
        },
      });
    } catch (error) {
      // 唯一约束违反：该 lesson 已有评价
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("RESOURCE_CONFLICT", 409, "Review already exists for this lesson");
      }
      throw error;
    }

    // 发通知给老师
    const teacher = await this.database.teacherProfile.findUnique({
      where: { id: lesson.teacherProfileId },
    });
    if (teacher) {
      await this.database.notification.upsert({
        where: {
          dedupeKey: `review-received:${lessonId}:${review.id}`,
        },
        create: {
          userId: teacher.userId,
          type: "REVIEW_RECEIVED",
          dedupeKey: `review-received:${lessonId}:${review.id}`,
          body: {
            lessonId,
            reviewId: review.id,
            childId: lesson.childId,
            parentProfileId,
            rating: review.rating,
          },
          targetRoute: null,
          targetParams: { lessonId },
        },
        update: {},
      });
    }

    return this.toDto(review);
  }

  // ─── getByLesson ─────────────────────────────────────────

  /** 按课程查看评价。 */
  async getByLesson(lessonId: string): Promise<ParentReviewDto | null> {
    const review = await this.database.parentReview.findUnique({
      where: { lessonId },
    });
    if (!review) return null;
    return this.toDto(review);
  }

  // ─── listByTeacher ───────────────────────────────────────

  /** 老师的公开评价列表。 */
  async listByTeacher(
    teacherProfileId: string,
    limit?: number,
  ): Promise<ParentReviewPublic[]> {
    const reviews = await this.database.parentReview.findMany({
      where: { teacherProfileId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return reviews.map((r) => this.toPublicDto(r));
  }

  // ─── listByParent ────────────────────────────────────────

  /** 家长的评价历史。 */
  async listByParent(parentProfileId: string): Promise<ParentReviewDto[]> {
    const reviews = await this.database.parentReview.findMany({
      where: { parentProfileId },
      orderBy: { createdAt: "desc" },
    });
    return reviews.map((r) => this.toDto(r));
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  /** 把记录转为对外 DTO。 */
  private toDto(review: ParentReviewRecord): ParentReviewDto {
    return {
      id: review.id,
      lessonId: review.lessonId,
      rating: review.rating,
      content: review.content,
      authorDisplayName: review.authorDisplayName,
      createdAt: review.createdAt.toISOString(),
    };
  }

  /** 把记录转为公开 DTO（含 lessonMonth）。 */
  private toPublicDto(review: ParentReviewRecord): ParentReviewPublic {
    const lessonMonth = `${review.createdAt.getUTCFullYear()}-${String(
      review.createdAt.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    return {
      id: review.id,
      rating: review.rating,
      content: review.content,
      authorDisplayName: review.authorDisplayName,
      lessonMonth,
      createdAt: review.createdAt.toISOString(),
    };
  }
}

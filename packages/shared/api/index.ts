/**
 * API 请求封装（类型定义层）
 *
 * 跨端 API 客户端的实际实现位于各端代码中：
 * - 移动端（Taro）：packages/mobile/src/services/api.ts
 * - 管理后台（Next.js）：packages/admin/src/lib/data.ts
 *
 * 共享类型定义在此导出，供两端复用。
 */

/** 列表接口统一响应格式 */
export interface ListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/** 平台统计数据 */
export interface PlatformStats {
  teacherCount: number;
  parentCount: number;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "RESOURCE_CONFLICT"
  | "MODEL_UNAVAILABLE"
  | "JOB_FAILED"
  | "INTERNAL_ERROR";

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: { code: ApiErrorCode; message: string; requestId: string };
    };

export {
  LEARNING_STYLE_QUESTIONS,
  LEARNING_STYLE_VERSION,
  LEARNING_STYLE_VERSION_CHECKSUM,
  LEARNING_STYLE_VERSION_CONFIGURATION,
  type LearningStyleAnswer,
  type LearningStyleOption,
  type LearningStyleSubmission,
} from "./assessments";

export type {
  SubjectCode,
  SchoolStageCode,
  AgentSummary,
  AgentDetail,
  ConversationSummary,
  ConversationDetail,
  TutorMessageDto,
  CreateConversationInput,
  AcceptMessageInput,
  QuotaAccountSummary,
  QuotaLedgerEntry,
  AdjustQuotaInput,
  TutorStreamEvent,
  TutorDashboard,
  TutoringSummaryDto,
} from "./tutoring";

export type {
  TeacherApplicationStatus,
  QualificationType,
  QualificationReviewStatus,
  TeacherServiceStatus,
  TeachingMode,
  TeacherApplicationSummary,
  TeacherApplicationDetail,
  TeacherQualificationSummary,
  TeacherAuditRecordSummary,
  TeacherProfileSummary,
  TeacherProfileDetail,
  RecommendationRequest,
  RecommendationReason,
  RecommendationItem,
  RecommendationResult,
  WeeklyAvailabilityRuleDto,
  AvailabilityExceptionDto,
  AvailabilitySlotDto,
  TrialBookingStatus,
  TrialBookingSummary,
  TrialBookingDetail,
  BookingChangeDto,
  LessonStatus,
  LessonSummary,
  FeedbackPerformance,
  TeacherFeedbackDto,
  ParentReviewDto,
  ParentReviewPublic,
  DataGrantScope,
  DataGrantSummary,
  TeacherDashboard,
  StudentSummaryDto,
} from "./human-tutoring";

/**
 * V2.3 真人家教跨端契约
 *
 * 包含老师申请、资质、审核、公开资料、推荐、排期、试听、课程、反馈、评价和授权的 DTO。
 */
import type { SubjectCode, SchoolStageCode } from "./tutoring";

// ─── 老师申请 ──────────────────────────────────────────────

export type TeacherApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_MORE_INFO"
  | "APPROVED" | "PAUSED" | "BANNED";

export type QualificationType =
  | "IDENTITY" | "EDUCATION" | "TEACHING_CERT" | "SUBJECT_CERT" | "OTHER";

export type QualificationReviewStatus = "PENDING" | "PASS" | "FAIL";

export type TeacherServiceStatus = "ACTIVE" | "PAUSED" | "BANNED";

export type TeachingMode = "ONLINE" | "IN_HOME" | "IN_CENTER";

export interface TeacherApplicationSummary {
  id: string;
  status: TeacherApplicationStatus;
  legalName: string;
  education: string | null;
  experienceYears: number | null;
  pricePerHour: number | null;
  bio: string | null;
  teachingModes: TeachingMode[];
  serviceAreaCode: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  qualifications: TeacherQualificationSummary[];
}

export interface TeacherQualificationSummary {
  id: string;
  type: QualificationType;
  reviewStatus: QualificationReviewStatus;
  reviewReason: string | null;
  reviewedAt: string | null;
}

export interface TeacherApplicationDetail extends TeacherApplicationSummary {
  auditRecords: TeacherAuditRecordSummary[];
}

export interface TeacherAuditRecordSummary {
  id: string;
  action: string;
  reason: string | null;
  actorAdminUserId: string | null;
  createdAt: string;
}

// ─── 老师公开资料 ──────────────────────────────────────────

export interface TeacherProfileSummary {
  id: string;
  displayName: string;
  bio: string;
  subjects: SubjectCode[];
  schoolStages: SchoolStageCode[];
  teachingModes: TeachingMode[];
  serviceAreaCodes: string[];
  teachingTags: string[];
  experienceYears: number;
  pricePerHour: number;
  serviceStatus: TeacherServiceStatus;
  avgRating: number | null;
  reviewCount: number;
}

export interface TeacherProfileDetail extends TeacherProfileSummary {
  recentReviews: ParentReviewPublic[];
  availabilityPreview: AvailabilitySlotDto[];
}

// ─── 推荐 ──────────────────────────────────────────────────

export interface RecommendationRequest {
  childId: string;
  subject: SubjectCode;
  preferredMode?: TeachingMode;
  budgetMaxPerHour?: number;
  minExperienceYears?: number;
  preferredStartsAt?: string;
  preferredEndsAt?: string;
}

export interface RecommendationReason {
  code: string;
  text: string;
}

export interface RecommendationItem {
  teacherId: string;
  displayName: string;
  subjects: SubjectCode[];
  schoolStages: SchoolStageCode[];
  experienceYears: number;
  pricePerHour: number;
  teachingModes: TeachingMode[];
  teachingTags: string[];
  score: number;
  reasons: RecommendationReason[];
  availabilitySlots: AvailabilitySlotDto[];
}

export interface RecommendationResult {
  items: RecommendationItem[];
  hardFilteredCount: number;
}

// ─── 排期 ──────────────────────────────────────────────────

export interface WeeklyAvailabilityRuleDto {
  id: string;
  weekday: number; // 1=周一 … 7=周日
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityExceptionDto {
  id: string;
  date: string; // YYYY-MM-DD（北京时间）
  type: "AVAILABLE" | "UNAVAILABLE";
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
}

export interface AvailabilitySlotDto {
  startsAt: string; // ISO UTC
  endsAt: string;
  weekday: number;
}

// ─── 试听 ──────────────────────────────────────────────────

export type TrialBookingStatus =
  | "REQUESTED" | "ACCEPTED" | "RESCHEDULE_PROPOSED" | "REJECTED"
  | "PARENT_CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";

export interface TrialBookingSummary {
  id: string;
  idempotencyKey: string;
  parentProfileId: string;
  childId: string;
  teacherProfileId: string;
  teacherDisplayName: string | null;
  subject: SubjectCode;
  startsAt: string;
  endsAt: string;
  status: TrialBookingStatus;
  mode: TeachingMode | null;
  parentNote: string | null;
  version: number;
  createdAt: string;
}

export interface TrialBookingDetail extends TrialBookingSummary {
  changes: BookingChangeDto[];
}

export interface BookingChangeDto {
  id: string;
  fromStatus: TrialBookingStatus;
  toStatus: TrialBookingStatus;
  action: string;
  actorKind: string;
  reason: string | null;
  proposedStartsAt: string | null;
  proposedEndsAt: string | null;
  createdAt: string;
}

// ─── 课程 ──────────────────────────────────────────────────

export type LessonStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface LessonSummary {
  id: string;
  childId: string;
  teacherProfileId: string;
  teacherDisplayName: string;
  subject: SubjectCode;
  startsAt: string;
  endsAt: string;
  status: LessonStatus;
  mode: TeachingMode | null;
  hasFeedback: boolean;
  hasReview: boolean;
  completedAt: string | null;
}

// ─── 老师反馈 ──────────────────────────────────────────────

export type FeedbackPerformance = "STRONG" | "STEADY" | "NEEDS_SUPPORT";

export interface TeacherFeedbackDto {
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
  correctionReason: string | null;
  createdByTeacherProfileId: string;
  createdAt: string;
}

// ─── 家长评价 ──────────────────────────────────────────────

export interface ParentReviewDto {
  id: string;
  lessonId: string;
  rating: number;
  content: string;
  authorDisplayName: string;
  createdAt: string;
}

export interface ParentReviewPublic {
  id: string;
  rating: number;
  content: string;
  authorDisplayName: string;
  lessonMonth: string; // YYYY-MM
  createdAt: string;
}

// ─── 授权 ──────────────────────────────────────────────────

export type DataGrantScope = "BASIC_PROFILE" | "LEARNING_NEEDS";

export interface DataGrantSummary {
  id: string;
  childId: string;
  teacherProfileId: string;
  teacherDisplayName: string;
  scopes: DataGrantScope[];
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  sourceBookingId: string | null;
}

// ─── 老师工作台 ────────────────────────────────────────────

export interface TeacherDashboard {
  pendingTrials: TrialBookingSummary[];
  upcomingLessons: LessonSummary[];
  lessonsAwaitingFeedback: LessonSummary[];
  activeStudents: Array<{
    childId: string;
    childDisplayName: string;
    subject: SubjectCode;
    nextLessonAt: string | null;
  }>;
  serviceStatus: TeacherServiceStatus;
}

// ─── 学生摘要（最小范围） ──────────────────────────────────

export interface StudentSummaryDto {
  childId: string;
  displayName: string;
  grade: string | null;
  learningGoals: string[];
  weakKnowledgePoints: string[];
  teachingPreferences: string[];
}

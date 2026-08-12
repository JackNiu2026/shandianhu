/**
 * V2.3 确定性可解释推荐引擎内部类型
 *
 * 这些类型仅在 server 包内部使用，用于在推荐流程的各步骤之间传递
 * 老师候选、孩子上下文、评分明细和排序结果。对外契约由
 * `@lightning-tiger/shared/api` 中的 DTO 承载，service 层负责把
 * RankedTeacher 映射为 RecommendationItem。
 */
import type { Subject, SchoolStage } from "@prisma/client";
import type { TeachingMode } from "@lightning-tiger/shared/api";

/** 老师候选快照：从 TeacherProfile 投影出的可匹配字段 */
export interface TeacherCandidate {
  id: string;
  displayName: string;
  subjects: Subject[];
  schoolStages: SchoolStage[];
  teachingModes: TeachingMode[];
  serviceAreaCodes: string[];
  teachingTags: string[];
  experienceYears: number;
  pricePerHour: number;
  serviceStatus: "ACTIVE" | "PAUSED" | "BANNED";
}

/** 用于匹配的孩子上下文：脱敏后的学习需求摘要 */
export interface ChildContextForMatch {
  childId: string;
  grade: string | null;
  schoolStage: SchoolStage;
  subject: Subject;
  weakKnowledgePoints: string[];
  learningGoals: string[];
  teachingPreferences: string[];
  serviceAreaCode: string | null;
}

/** 推荐引擎内部使用的请求结构（已展开 ParentProfile/Child 关系） */
export interface RecommendationRequestInternal {
  child: ChildContextForMatch;
  preferredMode?: TeachingMode;
  budgetMaxPerHour?: number;
  minExperienceYears?: number;
  preferredStartsAt?: Date;
  preferredEndsAt?: Date;
}

/** 评分明细：每一维度的得分及总分 */
export interface ScoreBreakdown {
  schedule: number;
  mode: number;
  budget: number;
  experience: number;
  teachingFit: number;
  subjectNeed: number;
  total: number;
}

/** 单条可解释原因：code 用于前端 i18n，text 用于直接展示 */
export interface RecommendationReason {
  code: string;
  text: string;
}

/** 单个可用时段：UTC 时间 + 周几（1=周一 … 7=周日） */
export interface AvailabilitySlot {
  startsAt: Date;
  endsAt: Date;
  weekday: number;
}

/** 排序后的老师：包含原候选、评分明细、可解释原因和可用时段 */
export interface RankedTeacher {
  teacher: TeacherCandidate;
  score: ScoreBreakdown;
  reasons: Array<RecommendationReason>;
  availabilitySlots: AvailabilitySlot[];
}

/**
 * 敏感标签黑名单：在生成可解释原因时必须过滤掉这些关键词，
 * 避免向家长暴露 MBTI、心理诊断等内部画像字段。
 */
export const SENSITIVE_LABELS = ["MBTI", "INTJ", "ENTP", "心理", "诊断", "精神"] as const;

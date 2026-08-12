/**
 * V2.3 确定性可解释推荐模块对外导出
 */
export { RecommendationService } from "./recommendation-service";
export type {
  RecommendInput,
  ListAllInput,
  RecommendationDatabase,
  RecommendationTeacherRecord,
  RecommendationAvailabilityRule,
  RecommendationAvailabilityException,
  RecommendationScheduleReservation,
  RecommendationTutoringSummary,
  RecommendationChildRecord,
  RecommendationParentProfileRecord,
} from "./recommendation-service";
export { hardFilter, scoreCompatibility, buildReasons, rankTeachers, overlap } from "./score";
export { SENSITIVE_LABELS } from "./types";
export type {
  TeacherCandidate,
  ChildContextForMatch,
  RecommendationRequestInternal,
  ScoreBreakdown,
  RankedTeacher,
  RecommendationReason,
  AvailabilitySlot,
} from "./types";

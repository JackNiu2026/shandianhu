/**
 * V2.3 真人家教：老师申请与审核服务
 */
export { ApplicationService } from "./application-service";
export type {
  ApplicationRecord,
  ApplicationDetail,
  ApplicationDraftInput,
  AddQualificationInput,
  ApplicationServiceDatabase,
} from "./application-service";

export { AuditService } from "./audit-service";
export type {
  ApplicationAuditDetail,
  ReviewQualificationInput,
  TeacherAuditDatabase,
  AuditRecord,
  ProfileRecord,
} from "./audit-service";

export { DashboardService } from "./dashboard-service";
export type {
  DashboardDatabase,
  TeacherProfileRecord as DashboardTeacherProfileRecord,
  TrialBookingRecord as DashboardTrialBookingRecord,
  LessonRecord as DashboardLessonRecord,
  TeacherFeedbackRecord,
  ParentReviewRecord,
} from "./dashboard-service";

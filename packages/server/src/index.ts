export { AppError } from "./errors/app-error";
export { prisma } from "./db/client";
export { resolveSession } from "./auth/session-service";
export { exchangeCodeForOpenId, wechatLogin } from "./auth/wechat-service";
export {
  authenticateAdminCredentials,
  changeAdminPassword,
  issueAdminSession,
  resolveAdminSession,
  revokeAdminSession,
} from "./auth/admin-session-service";
export { RedisLoginThrottle } from "./auth/redis-login-throttle";
export type { LoginThrottleStore } from "./auth/redis-login-throttle";
export { ChildService } from "./families/child-service";
export { NotificationService } from "./notifications/notification-service";
export { ParentDashboardService } from "./dashboard/parent-dashboard-service";
export { FileService } from "./files/file-service";
export { CosFileSigner, FILE_URL_TTL_SECONDS } from "./files/cos-client";
export { JobProcessingError, JobService } from "./jobs/job-service";
export { scoreLearningStyle } from "./assessments/learning-style";
export { LearningStyleAssessmentService } from "./assessments/assessment-service";
export { WrongQuestionService } from "./assessments/wrong-question-service";
export { wrongQuestionResultSchema } from "./assessments/wrong-question-schema";
export { ProfileService } from "./profiles/profile-service";
export type { ProfileDatabase } from "./profiles/profile-service";
export { scoreConfidence } from "./profiles/confidence";
export { ReportService } from "./reports/report-service";
export { ReportShareService, DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS, REPORT_SHARE_DOWNLOAD_TTL_SECONDS } from "./reports/share-service";
export { PrivacyDeletionService, RECOVERY_WINDOW_MS } from "./privacy/deletion-service";
export { AuditService, sanitizeAuditDiff } from "./audit/audit-service";
export { ASYNC_JOB_QUEUE_NAME, BullMqJobQueue, createRedisConnection } from "./jobs/queue";
export { ModelConfigService } from "./models/model-config-service";
export { OpenAiCompatibleGateway } from "./models/openai-gateway";
export { UsageService, calculateMicroCost } from "./models/usage-service";
export { AGENT_CATALOG, isApprovedAgent, stageForGrade, subjectsForStage } from "./agents/catalog";
export { AgentService, assertAgentUsable } from "./agents/agent-service";
export { PromptService } from "./agents/prompt-service";
export { PromptTestService } from "./agents/prompt-test-service";
export { buildContext, contextToSystemMessage } from "./tutoring/context-builder";
export { ModelRouter, ModelRouteError, requestRequiresVision, countImages } from "./tutoring/model-router";
export { ConversationService } from "./tutoring/conversation-service";
export { MessageService } from "./tutoring/message-service";
export type { ContextPart, ContextPartKind, BuildContextInput } from "./tutoring/context-builder";
export { calculatePoints, estimateReservationPoints, settleDifference, DEFAULT_POINTS_RATES } from "./quota/points";
export { QuotaService } from "./quota/quota-service";
export { NdjsonFrameEncoder, encodeEvent, encodeEvents, ndjsonIncrementalDecode } from "./streaming/ndjson";
export { StreamService, defaultCancellationRegistry, GenerationCancellationRegistry } from "./tutoring/stream-service";
export type { GenerationHandle, GenerationRuntime } from "./tutoring/stream-service";
export type {
  PointsRateConfig,
  UsageInput,
} from "./quota/points";
export type {
  QuotaAccountRecord,
  QuotaLedgerRecord,
  ReserveResult,
  SettleResult,
  ReleaseResult,
  AdjustResult,
  QuotaAccountSummary,
} from "./quota/quota-service";
export type {
  ModelProvider,
  ModelStreamEvent,
  ModelStreamHandle,
  ModelRouteRequest,
  OpenedStream,
  ModelProviderError,
} from "./tutoring/model-router";
export type { AuthSessionClient } from "./auth/session-service";
export type { WechatDatabase, WechatExchangeClient, WechatLoginResult } from "./auth/wechat-service";
export type {
  AdminSessionClient,
  AdminSessionIdentity,
  ChangeAdminPasswordResult,
} from "./auth/admin-session-service";
export type { ChildInput, ChildRecord, ChildServiceDatabase, ChildWorkspace } from "./families/child-service";
export type { FileObjectRecord, FileServiceDatabase, FileSigner, UploadInput } from "./files/file-service";
export type { AsyncJobRecord, AsyncJobStatus, AsyncJobType, JobDatabase, JobQueue } from "./jobs/job-service";
export type { LearningStyleResult } from "./assessments/learning-style";
export type { LearningStyleAssessmentDatabase, LearningStyleSubmissionResult } from "./assessments/assessment-service";
export type { WrongQuestionDatabase, WrongQuestionSubmission, WrongQuestionSubmissionResult } from "./assessments/wrong-question-service";
export type { WrongQuestionResult } from "./assessments/wrong-question-schema";
export type { ModelCapability, ModelConfigDto, ModelConfigInput, ModelConfigRecord } from "./models/model-config-service";
export type { ModelGatewayConfig, ModelMessage, StructuredCompletionInput, TextCompletionInput } from "./models/openai-gateway";
export type { ModelUsagePurpose, ModelUsageStatus, UsageLedgerEntry } from "./models/usage-service";
export type { LearningReportRecord, OwnedLearningReport, ReportBody, ReportDatabase } from "./reports/report-service";
export type { ReportDownloadSigner, ReportShareDatabase } from "./reports/share-service";
export type { PrivacyDatabase, PrivacyJobQueue } from "./privacy/deletion-service";
export type { AuditDatabase, AuditEntry } from "./audit/audit-service";
export type { SubjectCode, SchoolStageCode } from "./agents/catalog";
export type { AgentConfigRecord, AgentDatabase, AgentWithPrompt } from "./agents/agent-service";
export type { PromptDatabase, PromptStatus, PromptVersionRecord } from "./agents/prompt-service";
export type { PromptTestResult } from "./agents/prompt-test-service";
export { resolveRoleContext, assertParentContext, assertTeacherContext } from "./auth/role-context";
export type { ResolvedRoleContext, Workspace, AdminContext } from "./auth/role-context";
export { ApplicationService } from "./teachers/application-service";
export { AuditService as TeacherAuditService } from "./teachers/audit-service";
export { RecommendationService } from "./recommendations/recommendation-service";
export { hardFilter, scoreCompatibility, buildReasons, rankTeachers } from "./recommendations/score";
export type { TeacherCandidate, ChildContextForMatch, RecommendationRequestInternal, ScoreBreakdown, RankedTeacher } from "./recommendations/types";
export { GrantService } from "./grants/grant-service";
export type { CreateForBookingInput, ListStudentsItem, GrantTransactionClient, GrantServiceDatabase, DataGrantRecord } from "./grants/grant-service";
export { AvailabilityService } from "./scheduling/availability-service";
export type { AvailabilityDatabase, WeeklyRuleRecord, ExceptionRecord, WeeklyRuleInput } from "./scheduling/availability-service";
export {
  BEIJING_OFFSET_MINUTES,
  MIN_SEGMENT_MINUTES,
  MAX_SEGMENT_MINUTES,
  parseBeijingDateToUtcMidnight,
  formatUtcMidnightToDate,
  jsDayToSchemaWeekday,
  beijingMinuteToUtc,
} from "./scheduling/availability-service";
export { SlotService } from "./scheduling/slot-service";
export type { AvailabilitySlot, SlotDatabase, ReservationRecord as SlotReservationRecord } from "./scheduling/slot-service";
export { ConflictService } from "./scheduling/conflict-service";
export type { ConflictDatabase, ReservationRecord } from "./scheduling/conflict-service";
export { TrialService } from "./bookings/trial-service";
export type {
  TrialDatabase,
  TrialBookingRecord,
  BookingChangeRecord,
  LessonRecord,
  CreateTrialInput,
  TrialActor,
} from "./bookings/trial-service";
export { transition, type TrialEvent } from "./bookings/trial-state-machine";
export { FeedbackService } from "./lessons/feedback-service";
export { ReviewService } from "./lessons/review-service";
export { teacherFeedbackSchema } from "./lessons/feedback-schema";
export { DashboardService } from "./teachers/dashboard-service";

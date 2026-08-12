/**
 * 移动端 API 客户端
 * 基于 Taro.request，兼容小程序和 H5
 */
import Taro from "@tarojs/taro";
import type { ApiResult, Grade, LearningStyleSubmission } from "@lightning-tiger/shared";
import type {
  TeacherApplicationSummary,
  TeachingMode,
  WeeklyAvailabilityRuleDto,
  AvailabilityExceptionDto,
  AvailabilitySlotDto,
  TrialBookingSummary,
  TrialBookingDetail,
  TrialBookingStatus,
  LessonStatus,
  LessonSummary,
  TeacherFeedbackDto,
  FeedbackPerformance,
  ParentReviewDto,
  DataGrantSummary,
  TeacherDashboard,
  StudentSummaryDto,
  TeacherProfileDetail,
  RecommendationResult,
  RecommendationRequest,
  SubjectCode,
} from "@lightning-tiger/shared/api";

export type {
  TeacherApplicationSummary,
  TeachingMode,
  WeeklyAvailabilityRuleDto,
  AvailabilityExceptionDto,
  AvailabilitySlotDto,
  TrialBookingSummary,
  TrialBookingDetail,
  TrialBookingStatus,
  LessonStatus,
  LessonSummary,
  TeacherFeedbackDto,
  FeedbackPerformance,
  ParentReviewDto,
  DataGrantSummary,
  TeacherDashboard,
  StudentSummaryDto,
  TeacherProfileDetail,
  RecommendationResult,
  RecommendationRequest,
  SubjectCode,
};

/** API 基础地址 */
const API_BASE = process.env.TARO_APP_API_BASE || "http://localhost:3000";

/** 获取认证 token */
function getAuthToken(): string {
  try {
    return Taro.getStorageSync("auth-token") || "";
  } catch {
    return "";
  }
}

export function hasAuthToken(): boolean { return Boolean(getAuthToken()); }

/** 设置认证 token */
export function setAuthToken(token: string) {
  try {
    Taro.setStorageSync("auth-token", token);
  } catch (e) {
    console.warn("[Storage] 保存 token 失败", e);
  }
}

/** 清除认证 token */
export function clearAuthToken() {
  try {
    Taro.removeStorageSync("auth-token");
  } catch (e) {
    console.warn("[Storage] 清除 token 失败", e);
  }
}

/** 请求选项（不含 url，由 request 函数拼接） */
type RequestOptions = Omit<Taro.request.Option, "url">;

/** 请求封装 */
async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  try {
    const token = getAuthToken();
    const header: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.header as Record<string, string> || {}),
    };
    if (token) {
      header["Authorization"] = `Bearer ${token}`;
    }

    const res = await Taro.request({
      url: `${API_BASE}${url}`,
      method: "GET",
      header,
      ...options,
    } as Taro.request.Option);

    // 401: token 过期/无效，清除 token（登录弹窗由各页面自行处理）
    if (res.statusCode === 401) {
      clearAuthToken();
      Taro.eventCenter.trigger("auth:expired");
      throw new Error("登录已过期，请重新登录");
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T;
    }

    // 非 2xx：尝试提取错误信息并展示
    const apiError = (res.data as { error?: string | { code?: string; message?: string } })?.error;
    const errMsg = typeof apiError === "string" ? apiError : apiError?.message || "请求失败";
    Taro.showToast({ title: errMsg, icon: "none", duration: 2000 });
    throw new Error(errMsg);
  } catch (error) {
    console.error("[API Request Error]", url, error);
    throw error;
  }
}

async function requestV2<T>(url: string, options?: RequestOptions): Promise<T> {
  const result = await request<ApiResult<T>>(url, options);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export interface ChildSummary {
  id: string;
  displayName: string;
  grade: Grade;
  birthDate: string | null;
}

export type ChildWorkspace = {
  activeChildId: string | null;
  children: ChildSummary[];
};

type ChildResponse = {
  id: string;
  name: string;
  grade: string | null;
  birthDate: string | null;
};

function childSummary(child: ChildResponse): ChildSummary {
  return {
    id: child.id,
    displayName: child.name,
    grade: normalizeGrade(child.grade),
    birthDate: child.birthDate ?? null,
  };
}

function normalizeGrade(value: string | null): Grade {
  if (value === "小学") return "一年级";
  if (value === "初中") return "初一";
  if (value === "高中") return "高一";
  return (value ?? "一年级") as Grade;
}

export async function fetchChildren(): Promise<ChildWorkspace> {
  const response = await requestV2<{ activeChildId: string | null; children: ChildResponse[] }>("/api/v2/children");
  return { activeChildId: response.activeChildId, children: response.children.map(childSummary) };
}

export async function createChild(displayName: string, grade: Grade, birthDate?: string): Promise<ChildSummary> {
  const response = await requestV2<{ child: ChildResponse }>("/api/v2/children", {
    method: "POST",
    data: JSON.stringify({ displayName, grade, birthDate }),
  });
  return childSummary(response.child);
}

export async function updateChild(childId: string, input: { displayName: string; grade: Grade; birthDate: string }): Promise<ChildSummary> {
  const response = await requestV2<{ child: ChildResponse }>(`/api/v2/children/${childId}`, {
    method: "PATCH",
    data: JSON.stringify(input),
  });
  return childSummary(response.child);
}

export async function deleteChild(childId: string): Promise<void> {
  await requestV2(`/api/v2/privacy/children/${childId}`, { method: "DELETE" });
}

export async function restoreChild(childId: string): Promise<void> {
  await requestV2(`/api/v2/privacy/children/${childId}`, { method: "POST" });
}

export type DeletedChildSummary = ChildSummary & { deletedAt: string; purgeAfter: string };
export async function fetchDeletedChildren(): Promise<DeletedChildSummary[]> {
  const result = await requestV2<{ children: DeletedChildSummary[] }>("/api/v2/privacy/children/deleted");
  return result.children;
}

export async function setActiveChild(childId: string): Promise<ChildSummary> {
  const response = await requestV2<{ child: ChildResponse }>("/api/v2/children/active", {
    method: "PUT",
    data: JSON.stringify({ childId }),
  });
  return childSummary(response.child);
}

export async function submitLearningStyle(input: LearningStyleSubmission): Promise<{
  runId: string;
  resultId: string;
  taskId: string;
  code: string;
}> {
  return requestV2("/api/v2/assessments/learning-style", {
    method: "POST",
    data: JSON.stringify(input),
  });
}

export type WrongQuestionSubmission = { childId: string; fileIds: string[]; idempotencyKey: string };
export type AsyncTask = { id: string; status: "PENDING" | "RUNNING" | "RETRY_WAIT" | "SUCCEEDED" | "FAILED" | "DEAD_LETTER" };

export async function submitWrongQuestion(input: WrongQuestionSubmission): Promise<{ runId: string; taskId: string }> {
  return requestV2("/api/v2/assessments/wrong-questions", { method: "POST", data: JSON.stringify(input) });
}

export async function fetchTask(taskId: string): Promise<AsyncTask> {
  return requestV2<AsyncTask>(`/api/v2/jobs/${taskId}`);
}

export type LearningReport = {
  id: string;
  childId: string;
  sequence: number;
  status: "DRAFT" | "READY" | "ARCHIVED";
  narrativeVersion: string;
  body: {
    evidenceCount: number;
    evidenceIds: string[];
    confidence: number | null;
    latestObservedAt: string | null;
  };
  publishedAt: string | null;
  hasPdf: boolean;
};

export async function fetchLearningReport(reportId: string): Promise<LearningReport> {
  return requestV2<LearningReport>(`/api/v2/reports/${reportId}`);
}

export async function fetchLearningReportPdf(reportId: string): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
  return requestV2(`/api/v2/reports/${reportId}/pdf`);
}

export async function createReportShare(reportId: string, expiresInSeconds = 24 * 60 * 60): Promise<{
  id: string;
  token: string;
  expiresAt: string;
}> {
  return requestV2(`/api/v2/reports/${reportId}/shares`, {
    method: "POST",
    data: JSON.stringify({ expiresInSeconds }),
  });
}

/** 微信登录：用 wx.login 获取的 code 换取 session token */
export async function wechatLogin(code: string): Promise<{ token: string; userId: string }> {
  const result = await requestV2<{ token: string; userId: string }>("/api/v2/auth/wechat", {
    method: "POST",
    data: JSON.stringify({ code }),
  });
  setAuthToken(result.token);
  return result;
}

/** 通知条目 */
export type NotificationItem = {
  id: string;
  type: string;
  status: string;
  body: Record<string, unknown>;
  targetRoute: string | null;
  targetParams: Record<string, unknown> | null;
  createdAt: string;
};

/** 通知列表分页结果 */
type NotificationListResponse = {
  items: NotificationItem[];
  nextCursor: string | null;
};

/** 拉取当前用户的通知列表（支持游标分页） */
export async function fetchNotifications(
  cursor?: string,
): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestV2<NotificationListResponse>(`/api/v2/notifications${query}`);
}

/** 标记通知已读，不传 notificationId 则全部已读 */
export async function markNotificationsRead(notificationId?: string): Promise<void> {
  await requestV2(`/api/v2/notifications/read`, {
    method: "POST",
    data: JSON.stringify(notificationId ? { notificationId } : {}),
  });
}

/** 家长仪表盘数据 */
export type ParentDashboardData = {
  activeChild: { id: string; displayName: string; grade: string | null } | null;
  recentReports: Array<{ id: string; sequence: number; status: string; createdAt: string }>;
  pendingJobs: Array<{ id: string; type: string; status: string; createdAt: string }>;
  recentEvidence: Array<{ id: string; source: string; observedAt: string }>;
  unreadNotifications: number;
};

/** 拉取家长聚合仪表盘 */
export async function fetchDashboard(): Promise<ParentDashboardData> {
  return requestV2<ParentDashboardData>("/api/v2/dashboard");
}

// ============ V2.2 智学辅导（AI Tutor） ============

export type TutorSubject =
  | "CHINESE" | "MATH" | "ENGLISH" | "PHYSICS" | "CHEMISTRY"
  | "BIOLOGY" | "HISTORY" | "GEOGRAPHY" | "POLITICS";

export type TutorConversation = {
  id: string;
  childId: string;
  agentId: string;
  subject: TutorSubject;
  schoolStage: string;
  status: "ACTIVE" | "ARCHIVED";
  title: string | null;
  lastActivityAt: string;
  promptVersionSequence: number;
};

export type TutorMessageAttachment = {
  id: string;
  ordinal: number;
  fileObjectId: string;
};

export type TutorMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  clientMessageId: string | null;
  content: string;
  generationStatus: "PENDING" | "STREAMING" | "COMPLETE" | "CANCELLED" | "FAILED" | null;
  sequence: number;
  createdAt: string;
  attachments: TutorMessageAttachment[];
};

/** 创建会话 */
export async function createTutorConversation(input: {
  childId: string;
  subject: TutorSubject;
  title?: string | null;
}): Promise<TutorConversation> {
  const result = await requestV2<{ conversation: TutorConversation }>("/api/v2/tutor/conversations", {
    method: "POST",
    data: JSON.stringify({ childId: input.childId, subject: input.subject, title: input.title ?? null }),
  });
  return result.conversation;
}

/** 列出会话（按 lastActivityAt desc） */
export async function listTutorConversations(params?: {
  childId?: string;
  subject?: TutorSubject;
  limit?: number;
}): Promise<TutorConversation[]> {
  const qs = new URLSearchParams();
  if (params?.childId) qs.set("childId", params.childId);
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.limit) qs.set("limit", String(params.limit));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  const result = await requestV2<{ conversations: TutorConversation[] }>(`/api/v2/tutor/conversations${tail}`);
  return result.conversations;
}

/** 单会话详情 */
export async function getTutorConversation(conversationId: string): Promise<TutorConversation> {
  const result = await requestV2<{ conversation: TutorConversation }>(
    `/api/v2/tutor/conversations/${conversationId}`,
  );
  return result.conversation;
}

/** 列出会话消息 */
export async function listTutorMessages(
  conversationId: string,
  limit = 100,
): Promise<TutorMessage[]> {
  const result = await requestV2<{ messages: TutorMessage[] }>(
    `/api/v2/tutor/conversations/${conversationId}/messages?limit=${limit}`,
  );
  return result.messages;
}

/** 发送用户消息（幂等：同 clientMessageId 重复发送返回同一条） */
export async function sendTutorUserMessage(input: {
  conversationId: string;
  clientMessageId: string;
  content: string;
  attachmentFileObjectIds?: string[];
}): Promise<TutorMessage> {
  const result = await requestV2<{ message: TutorMessage }>(
    `/api/v2/tutor/conversations/${input.conversationId}/messages`,
    {
      method: "POST",
      data: JSON.stringify({
        content: input.content,
        clientMessageId: input.clientMessageId,
        attachmentFileObjectIds: input.attachmentFileObjectIds,
      }),
    },
  );
  return result.message;
}

/**
 * 流式请求：发起一个 tutor 生成会话，通过回调返回事件序列
 *
 * @returns { generationId, abort } generationId 可用来 POST cancel；abort 是前端本地断开
 */
export function startTutorStream(input: {
  conversationId: string;
  userClientMessageId?: string;
  onStart: (ev: { assistantMessageId: string; model: "primary" | "fallback" }) => void;
  onDelta: (ev: { text: string }) => void;
  onUsage?: (ev: { chargedPoints: number }) => void;
  onDone: (ev: { finishReason: "stop" | "length" | "cancelled" }) => void;
  onError: (ev: { code: string; retryable: boolean }) => void;
}): { generationId: string | null; abort: () => void } {
  let generationId: string | null = null;
  const task = Taro.request({
    url: `${API_BASE}/api/v2/tutor/conversations/${input.conversationId}/stream`,
    method: "POST",
    data: JSON.stringify({ userClientMessageId: input.userClientMessageId }),
    header: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
    enableChunked: true,
    timeout: 10 * 60 * 1000, // 10 分钟
    success(res: { statusCode?: number }) {
      // 完整响应非 2xx
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        input.onError({ code: `HTTP_${res.statusCode}`, retryable: res.statusCode >= 500 });
      }
    },
    fail(err: unknown) {
      // 部分微信基础库可能不完整地 fail；已经 chunk 回调过 delta 也无妨
      console.warn("[tutor-stream] request fail callback", err);
      input.onError({ code: "NETWORK_ERROR", retryable: true });
    },
  } as unknown as Taro.request.Option<any>);

  let residue: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  // 部分环境下，task 对象暴露 onChunkReceived。Taro H5 一般没有；小程序环境下可用。
  try {
    const req: any = task;
    if (typeof req.onHeadersReceived === "function") {
      req.onHeadersReceived((h: any) => {
        const headers = (h?.header || {}) as Record<string, string>;
        const gen = headers["X-Generation-Id"] || headers["x-generation-id"];
        if (gen) generationId = gen;
      });
    }
    if (typeof req.onChunkReceived === "function") {
      req.onChunkReceived((c: any) => {
        const arrayBuffer: ArrayBuffer = c?.data ?? c;
        if (!arrayBuffer) return;
        const bytes = new Uint8Array(arrayBuffer);
        const { events, residue: newResidue } = ndjsonChunkDecodeInlined(bytes, residue);
        residue = newResidue;
        for (const ev of events) dispatchEvent(ev, input);
      });
    } else {
      // H5 降级：Taro.request 没有分片时，把完整字符串 split('\n') 处理
      // 同时抛错误提醒调用方——正常生产建议用 fetch()
      console.warn("[tutor-stream] enableChunked 不支持，降级为同步解析完整响应");
      setTimeout(() => {
        try {
          const text = (task as any)?.data as string | undefined;
          if (!text) return;
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (typeof parsed?.type === "string") dispatchEvent(parsed as any, input);
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }, 50);
    }
  } catch (err) {
    console.warn("[tutor-stream] wiring error", err);
  }

  return {
    get generationId() { return generationId; },
    abort() {
      try { (task as any).abort?.(); } catch { /* ignore */ }
    },
  };
}

// 从 utils/ndjson inline 过来，避免跨模块循环和 tree-shaking 失败
import { ndjsonChunkDecode as ndjsonChunkDecodeInlined } from "../utils/ndjson";
function dispatchEvent(ev: any, handlers: Omit<Parameters<typeof startTutorStream>[0], "conversationId" | "userClientMessageId">) {
  switch (ev.type) {
    case "start": handlers.onStart(ev.data); break;
    case "delta": handlers.onDelta(ev.data); break;
    case "usage": handlers.onUsage?.(ev.data); break;
    case "done": handlers.onDone(ev.data); break;
    case "error": handlers.onError(ev.data); break;
  }
}

/** 请求取消一次生成（服务端尽力而为标志） */
export async function cancelTutorGeneration(generationId: string): Promise<{
  cancelled: boolean;
  message: string;
}> {
  return requestV2(`/api/v2/tutor/generations/${generationId}/cancel`, {
    method: "POST",
  });
}

// ============ V2.3 真人家教（Human Tutoring） ============

// ─── 老师端：申请 ──────────────────────────────────────────

/** 获取当前用户的老师申请（不存在则自动创建草稿） */
export async function getTeacherApplication(): Promise<TeacherApplicationSummary> {
  const result = await requestV2<{ application: TeacherApplicationSummary }>(
    "/api/v2/teacher/application",
  );
  return result.application;
}

/** 更新老师申请草稿字段（按需更新） */
export async function updateTeacherApplicationDraft(input: {
  legalName?: string;
  education?: string;
  experienceYears?: number;
  pricePerHour?: number;
  bio?: string;
  teachingModes?: TeachingMode[];
  serviceAreaCode?: string;
}): Promise<TeacherApplicationSummary> {
  const result = await requestV2<{ application: TeacherApplicationSummary }>(
    "/api/v2/teacher/application",
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.application;
}

/** 提交老师申请（DRAFT/NEEDS_MORE_INFO → SUBMITTED） */
export async function submitTeacherApplication(): Promise<TeacherApplicationSummary> {
  const result = await requestV2<{ application: TeacherApplicationSummary }>(
    "/api/v2/teacher/application/submit",
    { method: "POST" },
  );
  return result.application;
}

// ─── 老师端：排期 ──────────────────────────────────────────

/** 获取老师的周期可授课时间规则 */
export async function getWeeklyAvailability(): Promise<WeeklyAvailabilityRuleDto[]> {
  const result = await requestV2<{ rules: WeeklyAvailabilityRuleDto[] }>(
    "/api/v2/teacher/availability",
  );
  return result.rules;
}

/** 批量替换老师的周期可授课时间规则 */
export async function setWeeklyAvailability(
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>,
): Promise<WeeklyAvailabilityRuleDto[]> {
  const result = await requestV2<{ rules: WeeklyAvailabilityRuleDto[] }>(
    "/api/v2/teacher/availability",
    { method: "PUT", data: JSON.stringify({ rules }) },
  );
  return result.rules;
}

/** 获取老师的日期例外列表 */
export async function getAvailabilityExceptions(): Promise<AvailabilityExceptionDto[]> {
  const result = await requestV2<{ exceptions: AvailabilityExceptionDto[] }>(
    "/api/v2/teacher/availability/exceptions",
  );
  return result.exceptions;
}

/** 设置老师的日期例外（可用/不可用） */
export async function setAvailabilityException(input: {
  date: string;
  type: "AVAILABLE" | "UNAVAILABLE";
  startMinute?: number | null;
  endMinute?: number | null;
  reason?: string | null;
}): Promise<AvailabilityExceptionDto> {
  const result = await requestV2<{ exception: AvailabilityExceptionDto }>(
    "/api/v2/teacher/availability/exceptions",
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.exception;
}

// ─── 老师端：试听 ──────────────────────────────────────────

/** 获取分配给当前老师的试听列表 */
export async function listTeacherTrials(
  status?: TrialBookingStatus,
): Promise<TrialBookingSummary[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await requestV2<{ trials: TrialBookingSummary[] }>(
    `/api/v2/teacher/trials${qs}`,
  );
  return result.trials;
}

/** 获取试听详情（含变更历史时间线），家长和老师均可查看 */
export async function getTrialDetail(trialId: string): Promise<TrialBookingDetail> {
  const result = await requestV2<{ trial: TrialBookingDetail }>(
    `/api/v2/trials/${trialId}`,
  );
  return result.trial;
}

/** 老师对试听执行动作（接受/拒绝/建议改期/标记就绪/完成/取消） */
export async function performTrialAction(
  trialId: string,
  input: {
    action: "ACCEPT" | "REJECT" | "PROPOSE_RESCHEDULE" | "MARK_READY" | "COMPLETE" | "CANCEL";
    version: number;
    reason?: string;
    proposedStartsAt?: string;
    proposedEndsAt?: string;
  },
): Promise<TrialBookingSummary> {
  const result = await requestV2<{ trial: TrialBookingSummary }>(
    `/api/v2/teacher/trials/${trialId}/actions`,
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.trial;
}

// ─── 老师端：学生 ──────────────────────────────────────────

/** 获取当前老师有有效服务关系的学生列表 */
export async function listTeacherStudents(): Promise<
  Array<{ childId: string; childDisplayName: string; subject: SubjectCode; nextLessonAt: string | null }>
> {
  const result = await requestV2<{ students: Array<{ childId: string; childDisplayName: string; subject: SubjectCode; nextLessonAt: string | null }> }>(
    "/api/v2/teacher/students",
  );
  return result.students;
}

/** 老师读取学生最小范围学习摘要 */
export async function getStudentSummary(childId: string): Promise<StudentSummaryDto> {
  const result = await requestV2<{ summary: StudentSummaryDto }>(
    `/api/v2/teacher/students/${childId}`,
  );
  return result.summary;
}

// ─── 老师端：工作台 ────────────────────────────────────────

/** 获取老师工作台聚合数据 */
export async function fetchTeacherDashboard(): Promise<TeacherDashboard> {
  const result = await requestV2<{ dashboard: TeacherDashboard }>(
    "/api/v2/teacher/dashboard",
  );
  return result.dashboard;
}

// ─── 老师端：课程 ──────────────────────────────────────────

/** 获取分配给当前老师的课程列表 */
export async function listTeacherLessons(status?: LessonStatus): Promise<LessonSummary[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await requestV2<{ lessons: LessonSummary[] }>(
    `/api/v2/teacher/lessons${qs}`,
  );
  return result.lessons;
}

/** 老师标记课程完成 */
export async function completeLesson(
  lessonId: string,
): Promise<{ id: string; status: string; completedAt: string | null }> {
  const result = await requestV2<{ lesson: { id: string; status: string; completedAt: string | null } }>(
    `/api/v2/teacher/lessons/${lessonId}/complete`,
    { method: "POST" },
  );
  return result.lesson;
}

// ─── 老师端：反馈 ──────────────────────────────────────────

/** 老师查看课程反馈（含私有笔记） */
export async function getLessonFeedback(lessonId: string): Promise<TeacherFeedbackDto | null> {
  const result = await requestV2<{ feedback: TeacherFeedbackDto | null }>(
    `/api/v2/teacher/lessons/${lessonId}/feedback`,
  );
  return result.feedback;
}

/** 老师提交或修订课程反馈（operationKey 用于幂等） */
export async function submitLessonFeedback(
  lessonId: string,
  input: {
    operationKey: string;
    correctionReason?: string;
    feedback: {
      lessonContent: string[];
      performance: FeedbackPerformance;
      difficulties: string[];
      suggestions: string[];
      privateTeacherNote?: string;
    };
  },
): Promise<TeacherFeedbackDto> {
  const result = await requestV2<{ feedback: TeacherFeedbackDto }>(
    `/api/v2/teacher/lessons/${lessonId}/feedback`,
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.feedback;
}

// ─── 家长端：推荐与浏览 ────────────────────────────────────

/** 为指定孩子生成老师画像推荐 */
export async function recommendTutors(
  input: RecommendationRequest,
): Promise<RecommendationResult> {
  const result = await requestV2<{ result: RecommendationResult }>(
    "/api/v2/tutors/recommendations",
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.result;
}

/** 家长自主浏览老师列表 */
export async function listAllTutors(params: {
  subject: SubjectCode;
  schoolStage?: "PRIMARY" | "MIDDLE" | "HIGH";
  limit?: number;
}): Promise<TeacherProfileDetail[]> {
  const qs = new URLSearchParams({ subject: params.subject });
  if (params.schoolStage) qs.set("schoolStage", params.schoolStage);
  if (params.limit) qs.set("limit", String(params.limit));
  const result = await requestV2<{ tutors: TeacherProfileDetail[] }>(
    `/api/v2/tutors?${qs.toString()}`,
  );
  return result.tutors;
}

/** 家长查看老师详情 */
export async function getTutorDetail(teacherId: string): Promise<TeacherProfileDetail> {
  const result = await requestV2<TeacherProfileDetail | {
    teacher: Omit<TeacherProfileDetail, "recentReviews" | "availabilityPreview">;
    recentReviews: TeacherProfileDetail["recentReviews"];
    availabilityPreview: TeacherProfileDetail["availabilityPreview"];
  }>(`/api/v2/tutors/${teacherId}`);
  if ("teacher" in result) {
    return {
      ...result.teacher,
      recentReviews: result.recentReviews,
      availabilityPreview: result.availabilityPreview,
    };
  }
  return result;
}

// ─── 家长端：试听 ──────────────────────────────────────────

/** 家长查询与指定老师的试听历史 */
export async function listTrialsByParent(
  teacherId: string,
): Promise<TrialBookingSummary[]> {
  const result = await requestV2<{ trials: TrialBookingSummary[] }>(
    `/api/v2/tutors/${teacherId}/trials`,
  );
  return result.trials;
}

export async function listParentTrials(): Promise<TrialBookingSummary[]> {
  const result = await requestV2<{ trials: TrialBookingSummary[] }>("/api/v2/trials");
  return result.trials;
}

export async function listParentLessons(): Promise<LessonSummary[]> {
  const result = await requestV2<{ lessons: LessonSummary[] }>("/api/v2/lessons");
  return result.lessons;
}

/** 家长为指定老师发起试听 */
export async function createTrial(
  teacherId: string,
  input: {
    childId: string;
    subject: SubjectCode;
    startsAt: string;
    endsAt: string;
    idempotencyKey: string;
    mode?: TeachingMode;
    parentNote?: string;
  },
): Promise<TrialBookingSummary> {
  const result = await requestV2<{ trial: TrialBookingSummary }>(
    `/api/v2/tutors/${teacherId}/trials`,
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.trial;
}

// ─── 家长端：评价 ──────────────────────────────────────────

/** 家长查看课程评价 */
export async function getLessonReview(lessonId: string): Promise<ParentReviewDto | null> {
  const result = await requestV2<{ review: ParentReviewDto | null }>(
    `/api/v2/lessons/${lessonId}/review`,
  );
  return result.review;
}

/** 家长为已完成课程提交评价 */
export async function createLessonReview(
  lessonId: string,
  input: { rating: number; content: string },
): Promise<ParentReviewDto> {
  const result = await requestV2<{ review: ParentReviewDto }>(
    `/api/v2/lessons/${lessonId}/review`,
    { method: "POST", data: JSON.stringify(input) },
  );
  return result.review;
}

// ─── 家长端：数据授权 ──────────────────────────────────────

/** 家长查看自己发出的数据授权列表 */
export async function listParentGrants(): Promise<DataGrantSummary[]> {
  const result = await requestV2<{ grants: DataGrantSummary[] }>("/api/v2/grants");
  return result.grants;
}

/** 家长撤销数据授权（立即生效） */
export async function revokeGrant(grantId: string): Promise<DataGrantSummary> {
  const result = await requestV2<{ grant: DataGrantSummary }>(
    `/api/v2/grants/${grantId}/revoke`,
    { method: "POST" },
  );
  return result.grant;
}

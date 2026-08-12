/**
 * V2.2 智学系统跨端契约
 *
 * 包含智能体、会话、消息、积分账本和 NDJSON 流式事件的 DTO 定义。
 * 服务端、管理后台和小程序共用这些类型以保证 API 契约一致。
 */
import type { ApiErrorCode } from "./index";

// ─── 智能体 ────────────────────────────────────────────────

export type SubjectCode = "CHINESE" | "MATH" | "ENGLISH" | "PHYSICS" | "CHEMISTRY";
export type SchoolStageCode = "PRIMARY" | "MIDDLE" | "HIGH";

export interface AgentSummary {
  id: string;
  subject: SubjectCode;
  schoolStage: SchoolStageCode;
  status: "ENABLED" | "DISABLED";
  publishedPromptSequence: number | null;
  hasPrimaryModel: boolean;
  hasFallbackModel: boolean;
}

export interface AgentDetail extends AgentSummary {
  temperature: number;
  maxOutputTokens: number;
  primaryModelConfigId: string | null;
  fallbackModelConfigId: string | null;
}

// ─── 会话与消息 ────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  childId: string;
  agentId: string;
  subject: SubjectCode;
  schoolStage: SchoolStageCode;
  status: "ACTIVE" | "ARCHIVED";
  title: string | null;
  lastActivityAt: string;
  lastMessagePreview: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  promptVersionSequence: number;
  messages: TutorMessageDto[];
}

export type TutorMessageDto = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  generationStatus:
    | "PENDING"
    | "COMPLETE"
    | "PARTIAL"
    | "INTERRUPTED"
    | "FAILED"
    | "CANCELLED";
  sequence: number;
  createdAt: string;
  attachments: Array<{ id: string; ordinal: number; fileObjectId: string }>;
};

export interface CreateConversationInput {
  childId: string;
  subject: SubjectCode;
  title?: string;
}

export interface AcceptMessageInput {
  content: string;
  clientMessageId: string;
  attachmentFileObjectIds?: string[];
}

// ─── 积分账本 ──────────────────────────────────────────────

export interface QuotaAccountSummary {
  parentProfileId: string;
  availablePoints: string;
  reservedPoints: string;
}

export interface QuotaLedgerEntry {
  id: string;
  kind: "RESERVE" | "SETTLE" | "RELEASE" | "ADJUSTMENT";
  points: string;
  balanceAfter: string;
  childId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdjustQuotaInput {
  points: number;
  reason: string;
}

// ─── NDJSON 流式事件 ──────────────────────────────────────

export type TutorStreamEvent =
  | { type: "start"; sequence: number; data: { assistantMessageId: string; model: "primary" | "fallback" } }
  | { type: "delta"; sequence: number; data: { text: string } }
  | { type: "usage"; sequence: number; data: { chargedPoints: number } }
  | { type: "done"; sequence: number; data: { finishReason: "stop" | "length" | "cancelled" } }
  | { type: "error"; sequence: number; data: { code: ApiErrorCode; retryable: boolean } };

// ─── 智学首页 Dashboard ───────────────────────────────────

export interface TutorDashboard {
  activeChild: {
    id: string;
    name: string;
    grade: string | null;
    schoolStage: SchoolStageCode;
  } | null;
  agents: AgentSummary[];
  recentConversations: ConversationSummary[];
  availablePoints: string;
}

// ─── 辅导摘要 ─────────────────────────────────────────────

export interface TutoringSummaryDto {
  id: string;
  conversationId: string;
  version: number;
  knowledgePoints: Array<{
    name: string;
    performance: "STRONG" | "MIXED" | "WEAK";
  }>;
  difficulties: string[];
  demonstratedSkills: string[];
  nextSuggestions: string[];
  createdAt: string;
}

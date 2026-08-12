import { prisma } from "../db/client";

type AuditActorKind = "USER" | "ADMIN" | "SYSTEM" | "ASYNC_JOB";
type AuditEntityType =
  | "USER"
  | "CHILD"
  | "ASSESSMENT_RUN"
  | "LEARNING_REPORT"
  | "FILE_OBJECT"
  | "MODEL_CONFIG"
  | "AGENT_CONFIG"
  | "AGENT_PROMPT_VERSION"
  | "TUTOR_CONVERSATION"
  | "TUTOR_QUOTA_ACCOUNT";
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "SHARE" | "REVOKE";

export type AuditEntry = {
  actorKind: AuditActorKind;
  actorId?: string;
  actorUserId?: string;
  actorAdminUserId?: string;
  subjectUserId?: string;
  childId?: string;
  asyncJobId?: string;
  assessmentRunId?: string;
  learningReportId?: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  diff?: unknown;
};

export interface AuditDatabase {
  auditLog: { create(args: { data: Omit<AuditEntry, "diff"> & { sanitizedDiff: unknown } }): Promise<unknown> };
}

const SENSITIVE_KEY = /(password|secret|api.?key|token|prompt|phone|file|object.?key|image|url)/i;

export class AuditService {
  constructor(private readonly database: AuditDatabase = prisma as unknown as AuditDatabase) {}

  async record(entry: AuditEntry): Promise<void> {
    const { diff, ...metadata } = entry;
    await this.database.auditLog.create({
      data: { ...metadata, sanitizedDiff: sanitizeAuditDiff(diff) },
    });
  }
}

export function sanitizeAuditDiff(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditDiff);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!SENSITIVE_KEY.test(key)) output[key] = sanitizeAuditDiff(nested);
  }
  return output;
}

"use client";
/**
 * V2.3 老师申请详情与审核
 *
 * 资质逐项审核（PASS/FAIL）、批准/暂停/封禁/要求补材料。
 * - 全部必需资质（IDENTITY + EDUCATION）PASS 后方可批准
 * - 批准后创建公开 TeacherProfile（不含 legalName 和 fileObjectId）
 * - 暂停保留已确认课程但不接受新推荐/预约
 * - 封禁禁止老师工作区写操作
 * 管理员不能代替老师填写申请内容或修改资质文件。
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_MORE_INFO"
  | "APPROVED" | "PAUSED" | "BANNED";

type QualificationType = "IDENTITY" | "EDUCATION" | "CERTIFICATION" | "OTHER";
type QualificationReviewStatus = "PENDING" | "PASS" | "FAIL";

interface Qualification {
  id: string;
  type: QualificationType;
  fileObjectId: string;
  reviewStatus: QualificationReviewStatus;
  reviewReason: string | null;
  reviewedAt: string | null;
  reviewedByAdminUserId: string | null;
}

interface AuditRecord {
  id: string;
  action: string;
  reason: string | null;
  actorAdminUserId: string | null;
  createdAt: string;
}

interface ApplicationDetail {
  id: string;
  userId: string;
  status: ApplicationStatus;
  legalName: string;
  education: string | null;
  experienceYears: number | null;
  pricePerHour: number | null;
  bio: string | null;
  teachingModes: string[];
  serviceAreaCode: string | null;
  version: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  qualifications: Qualification[];
  auditRecords: AuditRecord[];
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  UNDER_REVIEW: "审核中",
  NEEDS_MORE_INFO: "需补材料",
  APPROVED: "已批准",
  PAUSED: "已暂停",
  BANNED: "已封禁",
};

function toneForStatus(status: ApplicationStatus): string {
  switch (status) {
    case "DRAFT": return "bg-slate-100 text-slate-600";
    case "SUBMITTED": return "bg-amber-100 text-amber-800";
    case "UNDER_REVIEW": return "bg-sky-100 text-sky-800";
    case "NEEDS_MORE_INFO": return "bg-violet-100 text-violet-800";
    case "APPROVED": return "bg-emerald-100 text-emerald-700";
    case "PAUSED": return "bg-orange-100 text-orange-700";
    case "BANNED": return "bg-rose-100 text-rose-700";
  }
}

function toneForReviewStatus(s: QualificationReviewStatus): string {
  switch (s) {
    case "PENDING": return "bg-amber-100 text-amber-800";
    case "PASS": return "bg-emerald-100 text-emerald-700";
    case "FAIL": return "bg-rose-100 text-rose-700";
  }
}

const QUAL_TYPE_LABEL: Record<QualificationType, string> = {
  IDENTITY: "身份证明",
  EDUCATION: "学历证明",
  CERTIFICATION: "资格证书",
  OTHER: "其他",
};

export default function TeacherApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 审核操作状态
  const [reviewReason, setReviewReason] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/admin/teacher-applications/${applicationId}`);
      const json = await res.json();
      if (json?.ok) {
        setDetail(json.data as ApplicationDetail);
      } else {
        setError(json?.error?.message ?? "加载失败");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applicationId]);

  async function reviewQualification(qualificationId: string, status: "PASS" | "FAIL") {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v2/admin/teacher-applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualificationId, status, reason: reviewReason || undefined }),
      });
      const json = await res.json();
      if (json?.ok) {
        setReviewReason("");
        await load();
        setActionMessage(`资质已标记为 ${status}`);
      } else {
        setActionMessage(json?.error?.message ?? "操作失败");
      }
    } catch (e) {
      setActionMessage(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function performAction(action: "approve" | "pause" | "ban" | "resume" | "requestMoreInfo") {
    if (action !== "approve" && action !== "resume" && !actionReason.trim()) {
      setActionMessage("请填写原因");
      return;
    }
    setSubmitting(true);
    setActionMessage(null);
    try {
      const body: Record<string, unknown> = { action };
      if (actionReason.trim()) body.reason = actionReason.trim();
      const res = await fetch(`/api/v2/admin/teacher-applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.ok) {
        setActionReason("");
        await load();
        setActionMessage("操作成功");
      } else {
        setActionMessage(json?.error?.message ?? "操作失败");
      }
    } catch (e) {
      setActionMessage(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Breadcrumb />
        <div className="text-ink-muted">加载中…</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Breadcrumb />
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-4">
          {error ?? "申请不存在"}
        </div>
        <Link href="/teachers" className="text-indigo-600 text-sm hover:underline">← 返回列表</Link>
      </div>
    );
  }

  const requiredPassed = (["IDENTITY", "EDUCATION"] as QualificationType[]).every((type) =>
    detail.qualifications.some((q) => q.type === type && q.reviewStatus === "PASS"),
  );
  const canApprove = requiredPassed && detail.status !== "APPROVED";

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">申请审核详情</h2>
          <div className="text-xs text-ink-muted mt-1">
            申请 ID：<code>{detail.id}</code> · 用户 ID：<code>{detail.userId}</code>
          </div>
        </div>
        <Link href="/teachers" className="text-indigo-600 text-sm hover:underline">← 返回列表</Link>
      </div>

      {actionMessage ? (
        <div className="bg-sky-50 border border-sky-200 text-sky-700 text-sm rounded-lg p-3">
          {actionMessage}
        </div>
      ) : null}

      {/* 申请信息 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneForStatus(detail.status)}`}>
            {STATUS_LABEL[detail.status]}
          </span>
          <span className="text-xs text-ink-muted">v{detail.version}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Field label="称呼（仅管理员可见）" value={detail.legalName} />
          <Field label="学历" value={detail.education ?? "—"} />
          <Field label="经验" value={detail.experienceYears != null ? `${detail.experienceYears} 年` : "—"} />
          <Field label="报价" value={detail.pricePerHour != null ? `¥${detail.pricePerHour}/h` : "—"} />
          <Field label="授课方式" value={detail.teachingModes.length > 0 ? detail.teachingModes.join("、") : "—"} />
          <Field label="服务区域" value={detail.serviceAreaCode ?? "—"} />
        </div>
        {detail.bio ? (
          <div className="text-sm">
            <span className="text-ink-muted">简介：</span>
            <p className="mt-1 text-ink">{detail.bio}</p>
          </div>
        ) : null}
        <div className="text-xs text-ink-muted">
          提交时间：{detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "（未提交）"}
        </div>
      </div>

      {/* 资质逐项审核 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">资质审核</h3>
        <div className="space-y-3">
          {detail.qualifications.length === 0 ? (
            <div className="text-sm text-ink-muted">暂无资质材料</div>
          ) : detail.qualifications.map((q) => (
            <div key={q.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink text-sm">{QUAL_TYPE_LABEL[q.type] ?? q.type}</span>
                  <span className={`ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${toneForReviewStatus(q.reviewStatus)}`}>
                    {q.reviewStatus}
                  </span>
                </div>
                <a
                  href={`/api/v2/files/${q.fileObjectId}/download-url`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  查看文件 →
                </a>
              </div>
              {q.reviewReason ? (
                <div className="mt-1 text-xs text-ink-muted">原因：{q.reviewReason}</div>
              ) : null}
              {q.reviewedAt ? (
                <div className="mt-1 text-[10px] text-ink-muted">
                  审核于 {new Date(q.reviewedAt).toLocaleString()}
                  {q.reviewedByAdminUserId ? ` by ${q.reviewedByAdminUserId.slice(0, 8)}` : ""}
                </div>
              ) : null}
              {detail.status === "SUBMITTED" || detail.status === "UNDER_REVIEW" || detail.status === "NEEDS_MORE_INFO" ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    disabled={submitting}
                    onClick={() => void reviewQualification(q.id, "PASS")}
                    className="px-3 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                  >
                    PASS
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => void reviewQualification(q.id, "FAIL")}
                    className="px-3 py-1 text-xs rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                  >
                    FAIL
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {detail.qualifications.length > 0 && (detail.status === "SUBMITTED" || detail.status === "UNDER_REVIEW" || detail.status === "NEEDS_MORE_INFO") ? (
          <div className="mt-3">
            <input
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="审核原因（可选，FAIL 时建议填写）"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      {/* 审核操作 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">审核操作</h3>
        {!requiredPassed ? (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
            需全部必需资质（身份证明 + 学历证明）PASS 后方可批准。当前状态：{requiredPassed ? "已满足" : "未满足"}
          </div>
        ) : null}
        <div className="space-y-3">
          <textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="操作原因（批准/恢复可留空；暂停/封禁/要求补材料必填）"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm min-h-[60px]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={submitting || !canApprove}
              onClick={() => void performAction("approve")}
              className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              title={canApprove ? "批准并创建公开 TeacherProfile" : "需全部必需资质 PASS"}
            >
              批准
            </button>
            <button
              disabled={submitting || detail.status !== "APPROVED"}
              onClick={() => void performAction("pause")}
              className="px-4 py-2 text-sm rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
            >
              暂停
            </button>
            <button
              disabled={submitting || detail.status === "BANNED" || detail.status === "DRAFT"}
              onClick={() => void performAction("ban")}
              className="px-4 py-2 text-sm rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50"
            >
              封禁
            </button>
            <button
              disabled={submitting || detail.status !== "PAUSED"}
              onClick={() => void performAction("resume")}
              className="px-4 py-2 text-sm rounded-md bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-50"
            >
              恢复
            </button>
            <button
              disabled={submitting || detail.status === "APPROVED" || detail.status === "BANNED"}
              onClick={() => void performAction("requestMoreInfo")}
              className="px-4 py-2 text-sm rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50"
            >
              要求补材料
            </button>
          </div>
        </div>
      </div>

      {/* 审核记录 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">审核记录</h3>
        <div className="space-y-2">
          {detail.auditRecords.length === 0 ? (
            <div className="text-sm text-ink-muted">暂无审核记录</div>
          ) : detail.auditRecords.map((r) => (
            <div key={r.id} className="text-xs border-l-2 border-slate-200 pl-3 py-1">
              <div className="font-medium text-ink">{r.action}</div>
              {r.reason ? <div className="text-ink-muted">原因：{r.reason}</div> : null}
              <div className="text-[10px] text-ink-muted">
                {new Date(r.createdAt).toLocaleString()}
                {r.actorAdminUserId ? ` · ${r.actorAdminUserId.slice(0, 8)}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

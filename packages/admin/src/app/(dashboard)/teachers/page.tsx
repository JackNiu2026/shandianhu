"use client";
/**
 * V2.3 老师申请审核列表
 *
 * 按状态筛选老师申请，点击进入详情页进行逐项审核。
 * 管理员可以批准/暂停/封禁/要求补材料，但不能代替老师填写申请内容。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_MORE_INFO"
  | "APPROVED" | "PAUSED" | "BANNED";

interface ApplicationRow {
  id: string;
  userId: string;
  status: ApplicationStatus;
  legalName: string;
  education: string | null;
  experienceYears: number | null;
  pricePerHour: number | null;
  bio: string | null;
  version: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export default function TeachersPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>("ALL");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (statusFilter !== "ALL") qp.set("status", statusFilter);
      const res = await fetch(`/api/v2/admin/teacher-applications?${qp.toString()}`);
      const json = await res.json();
      if (json?.ok) {
        setRows(json.data.items as ApplicationRow[]);
      } else {
        setError(json?.error?.message ?? "加载失败");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">老师申请审核</h2>
        <div className="text-xs text-ink-muted">
          管理员逐项审核资质，批准后创建公开 TeacherProfile
        </div>
      </div>

      {/* 筛选面板 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block text-xs text-ink-muted mb-1">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <button
            onClick={() => void load()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
          >
            应用筛选
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-4">
          加载失败：{error}
        </div>
      ) : null}

      {/* 申请列表 */}
      <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-ink-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">提交时间</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">称呼</th>
              <th className="px-3 py-2 text-left">学历</th>
              <th className="px-3 py-2 text-left">经验</th>
              <th className="px-3 py-2 text-left">报价</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">加载中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">无匹配申请</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap">
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "（未提交）"}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneForStatus(r.status)}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <div className="text-[10px] text-ink-muted mt-0.5">v{r.version}</div>
                </td>
                <td className="px-3 py-2 align-top font-medium text-ink">{r.legalName}</td>
                <td className="px-3 py-2 align-top text-xs">{r.education ?? "—"}</td>
                <td className="px-3 py-2 align-top text-xs">{r.experienceYears != null ? `${r.experienceYears} 年` : "—"}</td>
                <td className="px-3 py-2 align-top text-xs">{r.pricePerHour != null ? `¥${r.pricePerHour}/h` : "—"}</td>
                <td className="px-3 py-2 align-top text-right">
                  <Link
                    href={`/teachers/${r.id}`}
                    className="px-2 py-1 text-xs rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  >
                    审核详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-ink/5 text-sm text-ink-muted">
          {rows.length} 条记录
        </div>
      </div>
    </div>
  );
}

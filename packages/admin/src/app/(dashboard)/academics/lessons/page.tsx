"use client";
/**
 * V2.3 课程管理（管理员只读）
 *
 * 列出所有课程，可按状态/老师/科目筛选。
 * 管理员不能代替老师标记完成，也不能代替家长评价。
 */
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type LessonStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface LessonRow {
  id: string;
  status: LessonStatus;
  subject: string;
  startsAt: string;
  endsAt: string;
  mode: string | null;
  teacherProfileId: string;
  teacherDisplayName: string | null;
  childDisplayName: string | null;
  hasFeedback: boolean;
  hasReview: boolean;
  completedAt: string | null;
}

const STATUS_LABEL: Record<LessonStatus, string> = {
  SCHEDULED: "已排课",
  IN_PROGRESS: "进行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  NO_SHOW: "未到课",
};

function toneForStatus(status: LessonStatus): string {
  switch (status) {
    case "SCHEDULED": return "bg-sky-100 text-sky-800";
    case "IN_PROGRESS": return "bg-amber-100 text-amber-800";
    case "COMPLETED": return "bg-emerald-100 text-emerald-700";
    case "CANCELLED": return "bg-slate-100 text-slate-600";
    case "NO_SHOW": return "bg-rose-100 text-rose-700";
  }
}

const SUBJECTS = ["CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY"] as const;

export default function LessonsPage() {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | LessonStatus>("ALL");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<"ALL" | typeof SUBJECTS[number]>("ALL");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (statusFilter !== "ALL") qp.set("status", statusFilter);
      if (subjectFilter !== "ALL") qp.set("subject", subjectFilter);
      if (teacherFilter.trim()) qp.set("teacherProfileId", teacherFilter.trim());
      const res = await fetch(`/api/v2/admin/academics/lessons?${qp.toString()}`);
      const json = await res.json();
      if (json?.ok) {
        setRows(json.data.items as LessonRow[]);
      } else {
        setError(json?.error?.message ?? "加载失败");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, subjectFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (teacherFilter.trim() && !r.teacherProfileId.includes(teacherFilter.trim()) && !(r.teacherDisplayName ?? "").includes(teacherFilter.trim())) return false;
      return true;
    });
  }, [rows, teacherFilter]);

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">课程管理</h2>
        <div className="text-xs text-ink-muted">
          管理员只读：课程完成由老师推进，评价由家长提交
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
            {(Object.keys(STATUS_LABEL) as LessonStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">科目</label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">老师（ID 或名称）</label>
          <input
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
            placeholder="teacherProfileId 或名称"
          />
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

      {/* 课程列表 */}
      <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-ink-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">开始时间</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">科目</th>
              <th className="px-3 py-2 text-left">老师</th>
              <th className="px-3 py-2 text-left">孩子</th>
              <th className="px-3 py-2 text-left">反馈</th>
              <th className="px-3 py-2 text-left">评价</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">加载中…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">无匹配课程</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap">
                  {new Date(r.startsAt).toLocaleString()}
                  {r.completedAt ? (
                    <div className="text-[10px] text-emerald-600">完成于 {new Date(r.completedAt).toLocaleDateString()}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneForStatus(r.status)}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">{r.subject}</td>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-ink">{r.teacherDisplayName ?? truncate(r.teacherProfileId, 10)}</div>
                </td>
                <td className="px-3 py-2 align-top text-xs">{r.childDisplayName ?? "—"}</td>
                <td className="px-3 py-2 align-top">
                  {r.hasFeedback ? (
                    <span className="text-emerald-600 text-xs">● 已提交</span>
                  ) : r.status === "COMPLETED" ? (
                    <span className="text-amber-600 text-xs">○ 待反馈</span>
                  ) : (
                    <span className="text-ink-muted text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.hasReview ? (
                    <span className="text-emerald-600 text-xs">● 已评价</span>
                  ) : r.status === "COMPLETED" ? (
                    <span className="text-ink-muted text-xs">○ 未评价</span>
                  ) : (
                    <span className="text-ink-muted text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-ink/5 text-sm text-ink-muted">
          {filtered.length} 条记录
        </div>
      </div>
    </div>
  );
}

function truncate(s: string | null, n = 12): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

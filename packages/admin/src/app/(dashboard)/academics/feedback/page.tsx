"use client";
/**
 * V2.3 反馈管理（管理员只读）
 *
 * 列出所有老师结构化反馈，可查看详情（含 privateTeacherNote 供管理员查看）。
 * 管理员不能代替老师伪造反馈，也不能代替家长评价。
 * privateTeacherNote 仅管理员可见，不进入学习画像。
 */
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type FeedbackPerformance = "BELOW_EXPECTED" | "MEETS_EXPECTED" | "EXCEEDS_EXPECTED";

interface FeedbackRow {
  id: string;
  lessonId: string;
  sequence: number;
  isCurrent: boolean;
  performance: FeedbackPerformance;
  lessonContent: string[];
  difficulties: string[];
  suggestions: string[];
  privateTeacherNote: string | null;
  correctionReason: string | null;
  createdByTeacherProfileId: string;
  teacherDisplayName: string | null;
  childDisplayName: string | null;
  subject: string | null;
  lessonStartsAt: string | null;
  createdAt: string;
}

const PERFORMANCE_LABEL: Record<FeedbackPerformance, string> = {
  BELOW_EXPECTED: "低于预期",
  MEETS_EXPECTED: "符合预期",
  EXCEEDS_EXPECTED: "超出预期",
};

function toneForPerformance(p: FeedbackPerformance): string {
  switch (p) {
    case "BELOW_EXPECTED": return "bg-rose-100 text-rose-700";
    case "MEETS_EXPECTED": return "bg-sky-100 text-sky-700";
    case "EXCEEDS_EXPECTED": return "bg-emerald-100 text-emerald-700";
  }
}

export default function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teacherFilter, setTeacherFilter] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState<"ALL" | FeedbackPerformance>("ALL");
  const [currentOnly, setCurrentOnly] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (performanceFilter !== "ALL") qp.set("performance", performanceFilter);
      if (currentOnly) qp.set("isCurrent", "true");
      if (teacherFilter.trim()) qp.set("teacherProfileId", teacherFilter.trim());
      const res = await fetch(`/api/v2/admin/academics/feedback?${qp.toString()}`);
      const json = await res.json();
      if (json?.ok) {
        setRows(json.data.items as FeedbackRow[]);
      } else {
        setError(json?.error?.message ?? "加载失败");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [performanceFilter, currentOnly]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (teacherFilter.trim() && !r.createdByTeacherProfileId.includes(teacherFilter.trim()) && !(r.teacherDisplayName ?? "").includes(teacherFilter.trim())) return false;
      return true;
    });
  }, [rows, teacherFilter]);

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">反馈管理</h2>
        <div className="text-xs text-ink-muted">
          管理员只读：反馈由老师署名提交，privateTeacherNote 不进入学习画像
        </div>
      </div>

      {/* 筛选面板 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block text-xs text-ink-muted mb-1">表现等级</label>
          <select
            value={performanceFilter}
            onChange={(e) => setPerformanceFilter(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {(Object.keys(PERFORMANCE_LABEL) as FeedbackPerformance[]).map((p) => (
              <option key={p} value={p}>{PERFORMANCE_LABEL[p]}</option>
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
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={currentOnly}
              onChange={(e) => setCurrentOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            仅当前版本
          </label>
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

      {/* 反馈列表 */}
      <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-ink-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">提交时间</th>
              <th className="px-3 py-2 text-left">版本</th>
              <th className="px-3 py-2 text-left">表现</th>
              <th className="px-3 py-2 text-left">老师</th>
              <th className="px-3 py-2 text-left">孩子</th>
              <th className="px-3 py-2 text-left">私有备注</th>
              <th className="px-3 py-2 text-right">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">加载中…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink-muted">无匹配反馈</td></tr>
            ) : filtered.map((r) => (
              <>
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-xs font-mono">v{r.sequence}</span>
                    {r.isCurrent ? (
                      <span className="ml-1 text-[10px] text-emerald-600">当前</span>
                    ) : (
                      <span className="ml-1 text-[10px] text-ink-muted">历史</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneForPerformance(r.performance)}`}>
                      {PERFORMANCE_LABEL[r.performance]}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ink">{r.teacherDisplayName ?? truncate(r.createdByTeacherProfileId, 10)}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">{r.childDisplayName ?? "—"}</td>
                  <td className="px-3 py-2 align-top">
                    {r.privateTeacherNote ? (
                      <span className="text-amber-600 text-xs">● 有备注</span>
                    ) : (
                      <span className="text-ink-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
                    >
                      {expandedId === r.id ? "收起" : "查看"}
                    </button>
                  </td>
                </tr>
                {expandedId === r.id ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-3 bg-slate-50 border-l-4 border-indigo-400">
                      <div className="text-xs text-slate-700 space-y-2">
                        <div>
                          <span className="text-ink-muted font-medium">授课内容：</span>
                          <ul className="ml-4 list-disc">
                            {r.lessonContent.map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                        <div>
                          <span className="text-ink-muted font-medium">难点：</span>
                          {r.difficulties.length > 0 ? (
                            <span>{r.difficulties.join("；")}</span>
                          ) : <span className="text-ink-muted">（无）</span>}
                        </div>
                        <div>
                          <span className="text-ink-muted font-medium">建议：</span>
                          {r.suggestions.length > 0 ? (
                            <span>{r.suggestions.join("；")}</span>
                          ) : <span className="text-ink-muted">（无）</span>}
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded p-2">
                          <span className="text-amber-800 font-medium">私有老师备注（仅管理员可见，不进入画像）：</span>
                          <p className="mt-1 text-slate-700">{r.privateTeacherNote ?? "（无）"}</p>
                        </div>
                        {r.correctionReason ? (
                          <div>
                            <span className="text-ink-muted font-medium">修订原因：</span>
                            <span>{r.correctionReason}</span>
                          </div>
                        ) : null}
                        <div className="text-[10px] text-ink-muted pt-1">
                          反馈 ID：<code>{r.id}</code> · 课程 ID：<code>{r.lessonId}</code>
                          {r.lessonStartsAt ? <> · 课程时间：{new Date(r.lessonStartsAt).toLocaleString()}</> : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </>
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

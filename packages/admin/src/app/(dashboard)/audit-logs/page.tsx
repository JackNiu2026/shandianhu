"use client";
/**
 * V2.2 安全审计日志页
 * - 按 actor/entity/action/time 过滤
 * - 分页（cursor 向后翻页，向前重查）
 * - 点击条目展开 diff 详情
 */
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type ActorKind = "USER" | "ADMIN" | "SYSTEM" | "ASYNC_JOB";
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "SHARE" | "REVOKE";
type EntityType =
  | "USER" | "CHILD" | "ASSESSMENT_RUN" | "LEARNING_REPORT" | "FILE_OBJECT"
  | "MODEL_CONFIG" | "AGENT_CONFIG" | "AGENT_PROMPT_VERSION"
  | "TUTOR_CONVERSATION" | "TUTOR_QUOTA_ACCOUNT";

interface AuditRow {
  id: string;
  actorKind: ActorKind;
  actorId: string | null;
  actorAdminUserId: string | null;
  actorUserId: string | null;
  subjectUserId: string | null;
  childId: string | null;
  asyncJobId: string | null;
  assessmentRunId: string | null;
  learningReportId: string | null;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  diff: unknown;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [actorKind, setActorKind] = useState<"ALL" | ActorKind>("ALL");
  const [entityType, setEntityType] = useState<"ALL" | EntityType>("ALL");
  const [action, setAction] = useState<"ALL" | AuditAction>("ALL");
  const [actorId, setActorId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [fromIso, setFromIso] = useState("");
  const [toIso, setToIso] = useState("");

  async function load(cursor: string | null = null, mode: "replace" | "append" = "replace") {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (cursor) qp.set("cursor", cursor);
      if (actorKind !== "ALL") qp.set("actorKind", actorKind);
      if (entityType !== "ALL") qp.set("entityType", entityType);
      if (action !== "ALL") qp.set("action", action);
      if (actorId.trim()) qp.set("actorId", actorId.trim());
      if (entityId.trim()) qp.set("entityId", entityId.trim());
      if (fromIso) qp.set("fromIso", fromIso);
      if (toIso) qp.set("toIso", toIso);
      const res = await fetch(`/api/v2/admin/audit-logs?${qp.toString()}`);
      const json = await res.json();
      if (json?.ok) {
        const next = json.data.items as AuditRow[];
        setRows((prev) => mode === "append" ? [...prev, ...next] : next);
        setNextCursor(json.data.nextCursor);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(null, "replace"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [actorKind, entityType, action, actorId, entityId, fromIso, toIso]);

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">安全审计日志</h2>
        <div className="text-xs text-ink-muted">SUPERADMIN 专属：所有条目带敏感字段脱敏</div>
      </div>

      {/* 过滤面板 */}
      <div className="mt-4 bg-white rounded-xl border border-ink/5 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block text-xs text-ink-muted mb-1">Actor 类型</label>
          <select
            value={actorKind}
            onChange={(e) => setActorKind(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {(["USER","ADMIN","SYSTEM","ASYNC_JOB"] as ActorKind[]).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">实体类型</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {([
              "USER","CHILD","ASSESSMENT_RUN","LEARNING_REPORT","FILE_OBJECT",
              "MODEL_CONFIG","AGENT_CONFIG","AGENT_PROMPT_VERSION",
              "TUTOR_CONVERSATION","TUTOR_QUOTA_ACCOUNT",
            ] as EntityType[]).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">操作类型</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 px-3 py-2"
          >
            <option value="ALL">全部</option>
            {(["CREATE","UPDATE","DELETE","LOGIN","LOGOUT","SHARE","REVOKE"] as AuditAction[]).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">时间段（可选）</label>
          <div className="flex gap-2">
            <input type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} className="flex-1 rounded-md border border-slate-200 px-2 py-2 text-sm" />
            <input type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} className="flex-1 rounded-md border border-slate-200 px-2 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Actor ID</label>
          <input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="admin/user id" className="w-full rounded-md border border-slate-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Entity ID</label>
          <input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="conversationId/childId 等" className="w-full rounded-md border border-slate-200 px-3 py-2" />
        </div>
        <div className="md:col-span-2 self-end">
          <button
            onClick={() => void load(null, "replace")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
          >
            应用筛选 / 重置起点
          </button>
        </div>
      </div>

      {/* 表 */}
      <div className="mt-4 bg-white rounded-xl border border-ink/5 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-ink-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">操作</th>
              <th className="px-3 py-2 text-left">实体</th>
              <th className="px-3 py-2 text-left">关联</th>
              <th className="px-3 py-2 text-right">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">加载中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">无匹配日志</td></tr>
            ) : rows.map((r) => (
              <>
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <div className="font-medium text-ink">{r.actorKind}</div>
                    <div className="text-xs text-ink-muted">
                      {r.actorAdminUserId && <>admin: <code>{truncate(r.actorAdminUserId)}</code><br/></>}
                      {r.actorUserId && <>user: <code>{truncate(r.actorUserId)}</code></>}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneForAction(r.action)}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ink">{r.entityType}</div>
                    <div className="text-xs text-ink-muted"><code>{truncate(r.entityId, 24)}</code></div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap">
                    {r.childId && <>child: {truncate(r.childId, 8)}<br/></>}
                    {r.subjectUserId && <>subject: {truncate(r.subjectUserId, 8)}<br/></>}
                    {r.asyncJobId && <>job: {truncate(r.asyncJobId, 8)}<br/></>}
                    {r.learningReportId && <>report: {truncate(r.learningReportId, 8)}</>}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
                    >
                      {expandedId === r.id ? "收起" : "查看 Diff"}
                    </button>
                  </td>
                </tr>
                {expandedId === r.id ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-slate-50 border-l-4 border-indigo-400">
                      <pre className="text-xs text-slate-800 whitespace-pre-wrap font-mono overflow-auto max-h-80">
{JSON.stringify(r.diff, null, 2) || "(空)"}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-ink/5 flex items-center justify-between text-sm">
          <div className="text-ink-muted">{rows.length} 条记录</div>
          <div className="flex gap-2">
            <button
              disabled={loading || !nextCursor}
              onClick={() => void load(nextCursor, "append")}
              className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 disabled:opacity-50"
            >
              {loading ? "加载中…" : "加载更多"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string | null, n = 12): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function toneForAction(a: AuditAction): string {
  switch (a) {
    case "CREATE": return "bg-emerald-100 text-emerald-700";
    case "UPDATE": return "bg-amber-100 text-amber-800";
    case "DELETE": return "bg-rose-100 text-rose-700";
    case "LOGIN": return "bg-sky-100 text-sky-700";
    case "LOGOUT": return "bg-slate-100 text-slate-700";
    case "SHARE": return "bg-violet-100 text-violet-700";
    case "REVOKE": return "bg-orange-100 text-orange-700";
  }
}

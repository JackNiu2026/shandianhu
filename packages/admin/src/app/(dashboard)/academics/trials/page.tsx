"use client";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, DataTable, Select } from "@/components/ui";

type Trial = { id: string; status: string; subject: string; startsAt: string; teacherDisplayName: string | null; childDisplayName: string | null; changes: Array<{ toStatus: string; actorKind: string; createdAt: string }> };
const STATUS_LABEL: Record<string, string> = { REQUESTED: "待老师确认", ACCEPTED: "已接受", RESCHEDULE_PROPOSED: "待确认改期", PARENT_CONFIRMED: "家长已确认", READY: "已就绪", COMPLETED: "已完成", REJECTED: "已拒绝", CANCELLED: "已取消" };

export default function TrialsPage() {
  const [items, setItems] = useState<Trial[]>([]); const [status, setStatus] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { setLoading(true); const query = status ? `?status=${encodeURIComponent(status)}` : ""; void fetch(`/api/v2/admin/academics/trials${query}`).then((response) => response.json()).then((body) => { if (!body.ok) throw new Error(body.error?.message ?? "加载失败"); setItems(body.data.items); setError(""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败")).finally(() => setLoading(false)); }, [status]);
  return <div className="space-y-4"><Breadcrumb /><div><h2 className="text-xl font-bold">试听监督</h2><p className="text-sm text-ink-muted">只读查看家长与老师推进的试听状态，不代替任何一方操作。</p></div><Card><Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: "全部状态" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} /></Card>{error && <div className="border-2 border-danger bg-white p-3 text-danger">{error}</div>}<DataTable loading={loading} data={items} columns={[{ key: "childDisplayName", header: "学生", render: (row) => row.childDisplayName ?? "—" }, { key: "teacherDisplayName", header: "老师", render: (row) => row.teacherDisplayName ?? "—" }, { key: "subject", header: "科目" }, { key: "startsAt", header: "时间", render: (row) => new Date(row.startsAt).toLocaleString() }, { key: "status", header: "状态", render: (row) => <div><strong>{STATUS_LABEL[row.status] ?? row.status}</strong>{row.changes.slice(-1).map((change) => <div key={change.createdAt} className="text-xs text-ink-muted">{change.actorKind} · {STATUS_LABEL[change.toStatus] ?? change.toStatus}</div>)}</div> }]} /></div>;
}

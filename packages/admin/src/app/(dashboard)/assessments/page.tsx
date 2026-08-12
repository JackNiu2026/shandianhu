"use client";
import { useEffect, useState } from "react";
import { Card, DataTable, Input, Tabs } from "@/components/ui";

type LearningRow = { id: string; childName: string | null; status: string; assessmentName?: string; type?: string; sequence?: number; errorCode?: string | null; createdAt: string };
const statusLabel = (value: string) => ({ CREATED: "未开始", RUNNING: "处理中", SUCCEEDED: "已完成", FAILED: "失败", CANCELLED: "已取消", PENDING: "待处理", QUEUED: "排队中", RETRY_WAIT: "等待重试", READY: "已就绪", DRAFT: "生成中", ARCHIVED: "已归档" } as Record<string, string>)[value] ?? value;

export default function AssessmentsPage() {
  const [data, setData] = useState<{ runs: LearningRow[]; jobs: LearningRow[]; reports: LearningRow[] }>({ runs: [], jobs: [], reports: [] }); const [tab, setTab] = useState("runs"); const [childId, setChildId] = useState(""); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const body = await (await fetch(`/api/v2/admin/learning?childId=${encodeURIComponent(childId)}`)).json(); if (body.ok) setData(body.data); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const rows = tab === "runs" ? data.runs : tab === "jobs" ? data.jobs : data.reports;
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">学情中心</h2><p className="text-sm text-ink-muted">监督测评、异步任务和学习报告状态。</p></div><Card><div className="flex gap-2"><Input value={childId} onChange={(event) => setChildId(event.target.value)} placeholder="孩子 ID" /><button onClick={() => void load()} className="rounded-lg border-2 border-ink bg-action px-4 font-bold shadow-nb-sm">查询</button></div></Card><Tabs tabs={[{ value: "runs", label: `测评 ${data.runs.length}` }, { value: "jobs", label: `任务 ${data.jobs.length}` }, { value: "reports", label: `报告 ${data.reports.length}` }]} active={tab} onChange={setTab} /><DataTable loading={loading} data={rows} columns={[{ key: "childName", header: "孩子", render: (row) => row.childName ?? "—" }, { key: "status", header: "状态", render: (row) => statusLabel(row.status) }, { key: "type", header: "类型", render: (row) => row.assessmentName ?? row.type ?? `学习报告 v${row.sequence}` }, { key: "errorCode", header: "异常", render: (row) => row.errorCode ?? "—" }, { key: "createdAt", header: "创建时间", render: (row) => new Date(row.createdAt).toLocaleString() }]} /></div>;
}

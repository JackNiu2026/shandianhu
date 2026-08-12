"use client";
import { useEffect, useState } from "react";
import { Card, DataTable, Input, Select } from "@/components/ui";

type Row = { id: string; userId: string; childId: string | null; type: string; status: string; body: Record<string, unknown>; targetRoute: string | null; readAt: string | null; createdAt: string };
const labels: Record<string, string> = { ASSESSMENT_COMPLETE: "测评完成", REPORT_READY: "报告就绪", TRIAL_REQUESTED: "试听已申请", TRIAL_ACCEPTED: "试听已接受", TRIAL_REJECTED: "试听被拒绝", TRIAL_COMPLETED: "试听完成", LESSON_SCHEDULED: "课程已安排", LESSON_COMPLETED: "课程完成", FEEDBACK_RECEIVED: "收到老师反馈", REVIEW_RECEIVED: "收到家长评价", TEACHER_AUDIT_UPDATE: "老师审核更新", SYSTEM: "系统通知" };

export default function NotificationsPage() {
  const [items, setItems] = useState<Row[]>([]); const [status, setStatus] = useState(""); const [userId, setUserId] = useState(""); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const q = new URLSearchParams(); if (status) q.set("status", status); if (userId) q.set("userId", userId); const body = await (await fetch(`/api/v2/admin/notifications?${q}`)).json(); setItems(body.ok ? body.data.items : []); setLoading(false); };
  useEffect(() => { void load(); }, [status]);
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">通知监控</h2><p className="text-sm text-ink-muted">只读追踪业务通知生成与读取状态。</p></div><Card><div className="grid gap-3 md:grid-cols-3"><Input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="用户 ID" /><Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: "全部状态" }, { value: "UNREAD", label: "未读" }, { value: "READ", label: "已读" }]} /><button className="rounded-lg border-2 border-ink bg-action font-bold shadow-nb-sm" onClick={() => void load()}>查询</button></div></Card><DataTable loading={loading} data={items} columns={[{ key: "type", header: "类型", render: (row) => labels[row.type] ?? row.type }, { key: "status", header: "状态", render: (row) => row.status === "READ" ? "已读" : "未读" }, { key: "userId", header: "用户", render: (row) => <code>{row.userId}</code> }, { key: "body", header: "摘要", render: (row) => String(row.body.message ?? row.body.title ?? row.body.action ?? "—") }, { key: "targetRoute", header: "目标页面", render: (row) => row.targetRoute ?? "—" }, { key: "createdAt", header: "生成时间", render: (row) => new Date(row.createdAt).toLocaleString() }]} /></div>;
}

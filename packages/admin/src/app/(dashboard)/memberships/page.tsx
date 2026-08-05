"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Badge, Button, DataTable, Modal, Input, Select } from "@/components/ui";
import { statusToVariant, formatCurrency, formatDate } from "@/lib/utils";
import {
  getMemberships,
  createMembership,
  updateMembershipStatus,
  deleteMembership,
  getParents,
} from "@/lib/data";
import type { Membership, Parent } from "@/lib/types";

const statusLabels: Record<string, string> = {
  active: "有效",
  expired: "已过期",
  cancelled: "已取消",
};

const durationOptions = [
  { value: "月度会员", label: "月度会员" },
  { value: "季度会员", label: "季度会员" },
  { value: "年度会员", label: "年度会员" },
];

const durationAmounts: Record<string, number> = {
  "月度会员": 19.9,
  "季度会员": 49.9,
  "年度会员": 199,
};

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 创建弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    parentId: "",
    duration: "月度会员",
    startDate: formatDate(new Date()),
    endDate: "",
  });

  useEffect(() => {
    getMemberships()
      .then((data) => { setMemberships(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  // 打开创建弹窗时加载家长列表
  function openCreateModal() {
    if (parents.length === 0) {
      getParents()
        .then(setParents)
        .catch(() => {});
    }
    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 1);
    setForm({
      parentId: "",
      duration: "月度会员",
      startDate: formatDate(today),
      endDate: formatDate(end),
    });
    setCreateOpen(true);
  }

  function handleDurationChange(duration: string) {
    const today = new Date(form.startDate);
    const end = new Date(today);
    if (duration === "月度会员") end.setMonth(end.getMonth() + 1);
    else if (duration === "季度会员") end.setMonth(end.getMonth() + 3);
    else if (duration === "年度会员") end.setFullYear(end.getFullYear() + 1);
    setForm({ ...form, duration, endDate: formatDate(end) });
  }

  async function handleCreate() {
    if (!form.parentId) {
      setError("请选择家长");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await createMembership({
        parentId: form.parentId,
        duration: form.duration,
        amount: durationAmounts[form.duration],
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setMemberships([created, ...memberships]);
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(id: string, status: Membership["status"]) {
    try {
      await updateMembershipStatus(id, status);
      setMemberships(memberships.map((m) => (m.id === id ? { ...m, status } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除此会员记录？")) return;
    try {
      await deleteMembership(id);
      setMemberships(memberships.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  const columns = [
    { key: "parentName", header: "家长" },
    { key: "duration", header: "套餐" },
    { key: "amount", header: "金额", render: (m: Membership) => formatCurrency(m.amount) },
    { key: "startDate", header: "开始日期" },
    { key: "endDate", header: "结束日期" },
    { key: "status", header: "状态", render: (m: Membership) => <Badge variant={statusToVariant(m.status)}>{statusLabels[m.status] || m.status}</Badge> },
    {
      key: "actions", header: "操作", render: (m: Membership) => (
        <div className="flex gap-2">
          {m.status === "active" && <>
            <Button size="sm" variant="danger" onClick={() => handleUpdateStatus(m.id, "cancelled")}>取消</Button>
          </>}
          {m.status !== "expired" && (
            <Button size="sm" onClick={() => handleUpdateStatus(m.id, "expired")}>标记过期</Button>
          )}
          {m.status !== "active" && (
            <Button size="sm" variant="success" onClick={() => handleUpdateStatus(m.id, "active")}>激活</Button>
          )}
          <Button size="sm" onClick={() => handleDelete(m.id)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-ink">会员管理</h2>
        <Button variant="primary" onClick={openCreateModal}>+ 新建会员</Button>
      </div>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable columns={columns} data={memberships} loading={loading} emptyMessage="暂无会员数据" />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建会员">
        <div className="space-y-4">
          <Select
            label="选择家长"
            options={parents.map((p) => ({ value: p.id, label: `${p.name} (${p.phone})` }))}
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
          />
          <Select
            label="套餐类型"
            options={durationOptions}
            value={form.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
          />
          <Input
            label="开始日期"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="结束日期"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
          <div className="text-sm text-ink-muted">
            金额：<span className="font-bold text-ink">{formatCurrency(durationAmounts[form.duration])}</span>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="default" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button variant="primary" onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "确认创建"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader, StatCard, Badge, Button, DataTable } from "@/components/ui";
import { statusToVariant, formatCurrency, formatDate } from "@/lib/utils";
import { getWithdrawals, updateWithdrawalStatus } from "@/lib/data";
import type { Withdrawal } from "@/lib/types";

interface FinanceStats {
  revenue: { total: number; pending: number; available: number; membership: number };
  withdrawals: { total: number; pending: number; pendingCount: number; processedCount: number };
  lessons: { total: number };
}

export default function FinancePage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getWithdrawals(),
      fetch("/api/finance/stats").then((r) => r.json()),
    ]).then(([wData, sData]) => {
      setWithdrawals(wData);
      setStats(sData);
      setLoading(false);
    }).catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  async function processWithdrawal(id: string) {
    try {
      await updateWithdrawalStatus(id, "processed");
      setWithdrawals(withdrawals.map((w) => (w.id === id ? { ...w, status: "processed" } : w)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    }
  }

  const columns = [
    { key: "teacherName", header: "老师" },
    { key: "amount", header: "金额", render: (w: Withdrawal) => formatCurrency(w.amount) },
    { key: "createdAt", header: "申请时间", render: (w: Withdrawal) => formatDate(w.createdAt) },
    { key: "status", header: "状态", render: (w: Withdrawal) => <Badge variant={statusToVariant(w.status)}>{w.status === "pending" ? "待处理" : "已处理"}</Badge> },
    {
      key: "actions", header: "操作", render: (w: Withdrawal) => (
        w.status === "pending" ? <Button size="sm" variant="primary" onClick={() => processWithdrawal(w.id)}>处理</Button> : null
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">财务管理</h2>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="总收入" value={formatCurrency(stats.revenue.total)} icon="💰" />
          <StatCard label="待结算" value={formatCurrency(stats.revenue.pending)} icon="⏳" />
          <StatCard label="可提现" value={formatCurrency(stats.revenue.available)} icon="✅" />
          <StatCard label="会员收入" value={formatCurrency(stats.revenue.membership)} icon="🎟️" />
        </div>
      )}

      <Card>
        <CardHeader title="提现申请" />
        <DataTable columns={columns} data={withdrawals} loading={loading} emptyMessage="暂无提现申请" />
      </Card>
    </div>
  );
}

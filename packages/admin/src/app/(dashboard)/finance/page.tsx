"use client";

import * as React from "react";
import {
  teacherList,
  withdrawalList,
  updateWithdrawalStatus,
} from "@/lib/data";
import type { Withdrawal, TeacherAdmin } from "@/lib/types";
import { StatCard } from "@/components/ui/stat_card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

function WithdrawalStatusBadge({ status }: { status: Withdrawal["status"] }) {
  if (status === "pending") return <Badge variant="notice">待处理</Badge>;
  return <Badge variant="success">已处理</Badge>;
}

export default function FinancePage() {
  const [withdrawals, setWithdrawals] = React.useState<Withdrawal[]>(withdrawalList);
  const [busy, setBusy] = React.useState<string | null>(null);

  const rankedTeachers = React.useMemo(
    () => [...teacherList].sort((a, b) => b.totalRevenue - a.totalRevenue),
    [],
  );

  const totalRevenue = teacherList.reduce((s, t) => s + t.totalRevenue, 0);
  const pendingTotal = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((s, w) => s + w.amount, 0);

  const handleProcess = async (id: string) => {
    setBusy(id);
    try {
      await updateWithdrawalStatus(id, "processed");
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: "processed" } : w)),
      );
    } finally {
      setBusy(null);
    }
  };

  const teacherColumns: Column<TeacherAdmin>[] = [
    {
      key: "rank",
      header: "排名",
      align: "center",
      render: (_t, i) => (
        <span
          className={
            i < 3
              ? "flex h-6 w-6 items-center justify-center rounded-full bg-growth font-mono text-xs font-bold text-white"
              : "font-mono text-ink/50"
          }
        >
          {i + 1}
        </span>
      ),
    },
    {
      key: "name",
      header: "老师",
      render: (t) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">
            {t.name.slice(0, 1)}
          </span>
          <span className="font-medium text-ink">{t.name}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: "科目",
      render: (t) => <Badge variant="primary">{t.subject}</Badge>,
    },
    {
      key: "totalLessons",
      header: "总课时",
      align: "right",
      render: (t) => <span className="font-mono text-ink">{t.totalLessons}</span>,
    },
    {
      key: "totalRevenue",
      header: "总佣金",
      align: "right",
      render: (t) => (
        <span className="font-mono font-semibold text-ink">
          {formatCurrency(t.totalRevenue)}
        </span>
      ),
    },
    {
      key: "pendingRevenue",
      header: "待入账",
      align: "right",
      render: (t) => (
        <span className="font-mono text-notice">
          {formatCurrency(t.pendingRevenue)}
        </span>
      ),
    },
    {
      key: "availableRevenue",
      header: "可提现",
      align: "right",
      render: (t) => (
        <span className="font-mono text-success">
          {formatCurrency(t.availableRevenue)}
        </span>
      ),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: (t) => (
        <Button size="sm" variant="default">
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">财务管理</h1>
        <p className="mt-1 text-sm text-ink/50">
          平台收益、老师佣金结算与提现申请
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="总收入"
          value={formatCurrency(82680)}
          hint={`实算 ${formatCurrency(totalRevenue)}`}
        />
        <StatCard
          title="待入账"
          value={formatCurrency(10660)}
          hint="佣金尚未结算"
        />
        <StatCard
          title="已结算"
          value={formatCurrency(72020)}
          hint="已打款至老师账户"
        />
      </div>

      <Card
        title="老师收益排行"
        description="按总佣金降序排列"
        bodyClassName="p-0"
      >
        <DataTable
          columns={teacherColumns}
          data={rankedTeachers}
          rowKey={(t) => t.id}
        />
      </Card>

      <Card
        title="提现申请"
        description={`待处理金额 ${formatCurrency(pendingTotal)}`}
      >
        <div className="space-y-2">
          {withdrawals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/40">暂无提现申请</p>
          ) : (
            withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-surface-soft px-4 py-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-action-soft text-sm font-semibold text-action">
                  {w.teacherName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{w.teacherName}</p>
                  <p className="text-xs text-ink/50">
                    申请于 {formatDate(w.createdAt)}
                  </p>
                </div>
                <span className="ml-auto font-mono text-lg font-semibold text-ink">
                  {formatCurrency(w.amount)}
                </span>
                <WithdrawalStatusBadge status={w.status} />
                {w.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy === w.id}
                    onClick={() => handleProcess(w.id)}
                  >
                    处理
                  </Button>
                ) : (
                  <span className="text-xs text-ink/30">
                    {formatDateTime(w.createdAt)} 处理
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

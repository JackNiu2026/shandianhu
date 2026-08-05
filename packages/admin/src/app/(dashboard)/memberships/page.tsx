"use client";

import * as React from "react";
import { membershipList } from "@/lib/data";
import type { Membership, MembershipStatus } from "@/lib/types";
import { StatCard } from "@/components/ui/stat_card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAGE_SIZE = 8;

function statusBadge(status: MembershipStatus) {
  switch (status) {
    case "active":
      return <Badge variant="success">有效</Badge>;
    case "expired":
      return <Badge variant="default">过期</Badge>;
    case "cancelled":
      return <Badge variant="danger">已取消</Badge>;
  }
}

export default function MembershipsPage() {
  const [page, setPage] = React.useState(1);

  const activeCount = membershipList.filter((m) => m.status === "active").length;
  const totalAmount = membershipList
    .filter((m) => m.status !== "cancelled")
    .reduce((s, m) => s + m.amount, 0);

  const total = membershipList.length;
  const pageData = membershipList.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const columns: Column<Membership>[] = [
    {
      key: "parentName",
      header: "家长",
      render: (m) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-growth-soft text-sm font-semibold text-growth">
            {m.parentName.slice(0, 1)}
          </span>
          <span className="font-medium text-ink">{m.parentName}</span>
        </div>
      ),
    },
    {
      key: "duration",
      header: "订阅时长",
      render: (m) => <Badge variant="primary">{m.duration}</Badge>,
    },
    {
      key: "amount",
      header: "金额",
      align: "right",
      render: (m) => (
        <span className="font-mono font-semibold text-ink">
          {formatCurrency(m.amount)}
        </span>
      ),
    },
    {
      key: "startDate",
      header: "开始日期",
      render: (m) => <span className="text-ink/70">{formatDate(m.startDate)}</span>,
    },
    {
      key: "endDate",
      header: "到期日期",
      render: (m) => {
        const expired =
          m.status === "expired" ||
          new Date(m.endDate).getTime() < Date.now();
        return (
          <span className={expired ? "text-danger" : "text-ink/70"}>
            {formatDate(m.endDate)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "状态",
      render: (m) => statusBadge(m.status),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: () => <Button size="sm" variant="default">查看</Button>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">会员管理</h1>
        <p className="mt-1 text-sm text-ink/50">
          管理家长会员订阅、续费与到期情况
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="当前有效会员"
          value={activeCount}
          hint="状态为有效的订阅"
        />
        <StatCard
          title="本月新增"
          value={2}
          hint="近 30 天新开订阅"
        />
        <StatCard
          title="平均续费率"
          value="65%"
          hint="到期后续订比例"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-ink/60">
          订阅总额{" "}
          <span className="font-mono text-ink">{formatCurrency(totalAmount)}</span>
        </span>
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        rowKey={(m) => m.id}
        empty={
          <div className="py-10 text-center text-ink/40">暂无会员记录</div>
        }
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}

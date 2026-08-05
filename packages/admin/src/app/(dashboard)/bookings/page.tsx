"use client";

import * as React from "react";
import {
  bookingList,
  updateBookingStatus,
} from "@/lib/data";
import type { Booking, BookingStatus } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "待确认", value: "pending" },
  { label: "已确认", value: "confirmed" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "cancelled" },
];

const SUBJECT_OPTIONS = [
  { label: "全部科目", value: "all" },
  { label: "语文", value: "语文" },
  { label: "数学", value: "数学" },
  { label: "英语", value: "英语" },
  { label: "物理", value: "物理" },
  { label: "化学", value: "化学" },
];

const PAGE_SIZE = 8;

function statusBadge(status: BookingStatus) {
  switch (status) {
    case "pending":
      return <Badge variant="notice">待确认</Badge>;
    case "confirmed":
      return <Badge variant="success">已确认</Badge>;
    case "completed":
      return <Badge variant="success">已完成</Badge>;
    case "cancelled":
      return <Badge variant="danger">已取消</Badge>;
  }
}

export default function BookingsPage() {
  const [status, setStatus] = React.useState("all");
  const [subject, setSubject] = React.useState("all");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<Booking[]>(bookingList);
  const [busy, setBusy] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return rows.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (subject !== "all" && b.subject !== subject) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hit =
          b.parentName.toLowerCase().includes(kw) ||
          b.teacherName.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, status, subject, keyword]);

  React.useEffect(() => {
    setPage(1);
  }, [status, subject, keyword]);

  const total = filtered.length;
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAction = async (id: string, next: BookingStatus) => {
    setBusy(id);
    try {
      await updateBookingStatus(id, next);
      setRows((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: next } : b)),
      );
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = rows.filter((b) => b.status === "pending").length;

  const columns: Column<Booking>[] = [
    {
      key: "parentName",
      header: "家长",
      render: (b) => <span className="font-medium text-ink">{b.parentName}</span>,
    },
    {
      key: "teacherName",
      header: "老师",
      render: (b) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">
            {b.teacherName.slice(0, 1)}
          </span>
          <span className="text-ink">{b.teacherName}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: "科目",
      render: (b) => <Badge variant="primary">{b.subject}</Badge>,
    },
    {
      key: "slot",
      header: "预约时段",
      render: (b) => <span className="text-ink/80">{b.slot}</span>,
    },
    {
      key: "status",
      header: "状态",
      render: (b) => statusBadge(b.status),
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (b) => (
        <span className="text-ink/60">{formatDateTime(b.createdAt)}</span>
      ),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: (b) => {
        const loading = busy === b.id;
        if (b.status === "pending") {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="success"
                disabled={loading}
                onClick={() => handleAction(b.id, "confirmed")}
              >
                确认
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => handleAction(b.id, "cancelled")}
              >
                取消
              </Button>
            </div>
          );
        }
        return <span className="text-xs text-ink/30">—</span>;
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">预约管理</h1>
          <p className="mt-1 text-sm text-ink/50">
            处理家长与老师之间的预约请求
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-notice-soft px-3 py-1 text-xs font-medium text-notice">
            <span className="h-1.5 w-1.5 rounded-full bg-notice" />
            <span className="font-mono">{pendingCount}</span> 条待处理
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface-paper p-4 shadow-nb-sm">
        <div className="w-36">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="w-32">
          <Select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            options={SUBJECT_OPTIONS}
          />
        </div>
        <div className="ml-auto w-64">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索家长 / 老师"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        rowKey={(b) => b.id}
        empty={
          <div className="py-10 text-center text-ink/40">没有匹配的预约记录</div>
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

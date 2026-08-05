"use client";

import * as React from "react";
import { reviewList, updateReviewStatus } from "@/lib/data";
import type { Review, ReviewStatus } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "待审核", value: "pending" },
  { label: "已通过", value: "approved" },
  { label: "已拒绝", value: "rejected" },
];

const PAGE_SIZE = 8;

function statusBadge(status: ReviewStatus) {
  switch (status) {
    case "pending":
      return <Badge variant="notice">待审核</Badge>;
    case "approved":
      return <Badge variant="success">已通过</Badge>;
    case "rejected":
      return <Badge variant="danger">已拒绝</Badge>;
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-notice">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "" : "opacity-25"}>
          ★
        </span>
      ))}
      <span className="ml-1 font-mono text-xs text-ink/60">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const [status, setStatus] = React.useState("all");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<Review[]>(reviewList);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hit =
          r.teacherName.toLowerCase().includes(kw) ||
          r.author.toLowerCase().includes(kw) ||
          r.text.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, status, keyword]);

  React.useEffect(() => {
    setPage(1);
  }, [status, keyword]);

  const total = filtered.length;
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleStatus = async (id: string, next: ReviewStatus) => {
    setBusy(id);
    try {
      await updateReviewStatus(id, next);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next } : r)),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
    }
  };

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const columns: Column<Review>[] = [
    {
      key: "teacherName",
      header: "老师",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">
            {r.teacherName.slice(0, 1)}
          </span>
          <span className="font-medium text-ink">{r.teacherName}</span>
        </div>
      ),
    },
    {
      key: "author",
      header: "评价人",
      render: (r) => <span className="text-ink/70">{r.author}</span>,
    },
    {
      key: "text",
      header: "评价内容",
      render: (r) => (
        <span
          className="block max-w-xs truncate text-ink/70"
          title={r.text}
        >
          {r.text}
        </span>
      ),
    },
    {
      key: "rating",
      header: "评分",
      render: (r) => <Stars rating={r.rating} />,
    },
    {
      key: "status",
      header: "状态",
      render: (r) => statusBadge(r.status),
    },
    {
      key: "createdAt",
      header: "时间",
      render: (r) => (
        <span className="text-ink/50">{formatDateTime(r.createdAt)}</span>
      ),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: (r) => {
        const loading = busy === r.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {r.status !== "approved" && (
              <Button
                size="sm"
                variant="success"
                disabled={loading}
                onClick={() => handleStatus(r.id, "approved")}
              >
                通过
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button
                size="sm"
                variant="default"
                disabled={loading}
                onClick={() => handleStatus(r.id, "rejected")}
              >
                拒绝
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              disabled={loading}
              onClick={() => setDeleteId(r.id)}
            >
              删除
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">评价管理</h1>
          <p className="mt-1 text-sm text-ink/50">
            审核家长对老师的评价内容
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-notice-soft px-3 py-1 text-xs font-medium text-notice">
            <span className="h-1.5 w-1.5 rounded-full bg-notice" />
            <span className="font-mono">{pendingCount}</span> 条待审核
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
        <div className="ml-auto w-64">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索老师 / 评价人 / 内容"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        rowKey={(r) => r.id}
        empty={
          <div className="py-10 text-center text-ink/40">没有匹配的评价记录</div>
        }
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="删除评价"
        description="此操作不可撤销，确定要删除该评价吗？"
        footer={
          <>
            <Button variant="default" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink/70">
          评价删除后将无法恢复，且不再展示在老师主页。
        </p>
      </Modal>
    </div>
  );
}

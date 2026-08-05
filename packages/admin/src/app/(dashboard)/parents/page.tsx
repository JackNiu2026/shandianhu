"use client";

import * as React from "react";
import Link from "next/link";
import { parentList } from "@/lib/data";
import type { Parent } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";

const GRADE_OPTIONS = [
  { label: "全部学段", value: "all" },
  { label: "小学", value: "小学" },
  { label: "初中", value: "初中" },
  { label: "高中", value: "高中" },
];

const STATUS_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "正常", value: "active" },
  { label: "已封禁", value: "blocked" },
];

const PAGE_SIZE = 8;

export default function ParentsPage() {
  const [grade, setGrade] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    return parentList.filter((p) => {
      if (grade !== "all" && p.childGrade !== grade) return false;
      if (status !== "all" && p.status !== status) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hit =
          p.name.toLowerCase().includes(kw) ||
          p.phone.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      return true;
    });
  }, [grade, status, keyword]);

  React.useEffect(() => {
    setPage(1);
  }, [grade, status, keyword]);

  const total = filtered.length;
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Parent>[] = [
    {
      key: "name",
      header: "家长",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-growth-soft text-sm font-semibold text-growth">
            {p.avatar}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{p.name}</p>
            <p className="truncate text-xs text-ink/40">
              注册于 {formatDate(p.createdAt)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "手机号",
      render: (p) => (
        <span className="font-mono text-ink/80">{p.phone}</span>
      ),
    },
    {
      key: "childGrade",
      header: "孩子学段",
      render: (p) => <Badge variant="primary">{p.childGrade}</Badge>,
    },
    {
      key: "likedTeachers",
      header: "收藏老师",
      align: "center",
      render: (p) => (
        <span className="font-mono text-ink">{p.likedTeachers.length}</span>
      ),
    },
    {
      key: "bookingCount",
      header: "预约数",
      align: "center",
      render: (p) => (
        <span className="font-mono text-ink">{p.bookingCount}</span>
      ),
    },
    {
      key: "mbti",
      header: "MBTI 结果",
      render: (p) =>
        p.mbtiResult ? (
          <span className="font-mono font-semibold text-growth">
            {p.mbtiResult.code}
          </span>
        ) : (
          <span className="text-ink/40">未测评</span>
        ),
    },
    {
      key: "status",
      header: "状态",
      render: (p) =>
        p.status === "active" ? (
          <Badge variant="success">正常</Badge>
        ) : (
          <Badge variant="danger">已封禁</Badge>
        ),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: (p) => (
        <Link
          href={`/parents/${p.id}`}
          className="inline-flex items-center rounded-md border border-ink/15 bg-surface-paper px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-soft"
        >
          查看
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">家长管理</h1>
          <p className="mt-1 text-sm text-ink/50">
            管理平台家长账户、偏好与测评信息
          </p>
        </div>
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-ink/60">
          共 <span className="font-mono text-ink">{parentList.length}</span> 位家长
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface-paper p-4 shadow-nb-sm">
        <div className="w-40">
          <Select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            options={GRADE_OPTIONS}
          />
        </div>
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
            placeholder="搜索姓名 / 手机号"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        rowKey={(p) => p.id}
        empty={
          <div className="py-10 text-center text-ink/40">
            没有匹配的家长记录
          </div>
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

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import Input from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { teacherList } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { subjects, grades } from "@lightning-tiger/shared";
import type { TeacherAdmin } from "@/lib/types";

const statusConfig: Record<
  TeacherAdmin["status"],
  { label: string; variant: "success" | "notice" | "danger" }
> = {
  active: { label: "已上线", variant: "success" },
  pending: { label: "待审核", variant: "notice" },
  blocked: { label: "已封禁", variant: "danger" },
};

export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTeachers = useMemo(() => {
    return teacherList.filter((t) => {
      // 搜索：姓名
      if (search && !t.name.includes(search.trim())) return false;
      // 科目筛选
      if (subjectFilter !== "all" && t.subject !== subjectFilter) return false;
      // 学段筛选
      if (gradeFilter !== "all" && !t.grades.includes(gradeFilter as never))
        return false;
      // 状态筛选
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [search, subjectFilter, gradeFilter, statusFilter]);

  const columns: Column<TeacherAdmin>[] = [
    {
      key: "name",
      header: "姓名",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-growth-soft grid place-items-center font-bold text-ink shrink-0">
            {t.name.charAt(0)}
          </div>
          <span className="font-semibold">{t.name}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: "科目",
      render: (t) => <span className="font-medium">{t.subject}</span>,
    },
    {
      key: "grades",
      header: "学段",
      render: (t) => (
        <span className="text-ink-muted">{t.grades.join(" / ")}</span>
      ),
    },
    {
      key: "rating",
      header: "评分",
      render: (t) => (
        <span className="font-mono font-semibold">
          {t.rating}
          <span className="ml-1">⭐</span>
        </span>
      ),
    },
    {
      key: "price",
      header: "价格",
      render: (t) => (
        <span className="font-mono font-semibold">
          {formatCurrency(t.price)}
          <span className="text-ink-muted text-xs ml-0.5">/课时</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (t) => {
        const cfg = statusConfig[t.status];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "操作",
      render: (t) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/teachers/${t.id}`}
            className="px-3 py-1 rounded-md border-2 border-ink bg-surface-soft text-xs font-semibold shadow-nb-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            查看
          </Link>
          <Link
            href={`/teachers/${t.id}`}
            className="px-3 py-1 rounded-md border-2 border-ink bg-growth-soft text-xs font-semibold shadow-nb-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            编辑
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 标题 + 新建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">老师管理</h1>
          <p className="text-sm text-ink-muted mt-1">
            共 {teacherList.length} 位老师，已展示 {filteredTeachers.length} 条
          </p>
        </div>
        <Button asChild href="/teachers/new" variant="primary">
          + 新建老师
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <div className="grid grid-cols-4 gap-4">
          <Select
            label="科目"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            options={[
              { value: "all", label: "全部科目" },
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
          />
          <Select
            label="学段"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            options={[
              { value: "all", label: "全部学段" },
              ...grades.map((g) => ({ value: g, label: g })),
            ]}
          />
          <Select
            label="状态"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "全部状态" },
              { value: "active", label: "已上线" },
              { value: "pending", label: "待审核" },
              { value: "blocked", label: "已封禁" },
            ]}
          />
          <Input
            label="搜索"
            placeholder="输入老师姓名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={filteredTeachers}
        rowKey={(t) => t.id}
      />
    </div>
  );
}

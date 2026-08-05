import Link from "next/link";
import { notFound } from "next/navigation";
import { getParentById, bookingList } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty_state";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Booking } from "@/lib/types";
import { budgetOptions } from "@lightning-tiger/shared";

interface PageProps {
  params: Promise<{ id: string }>;
}

function budgetLabel(value: number): string {
  const found = budgetOptions.find((b) => b.value === value);
  return found ? found.label : `¥${value}`;
}

function bookingStatusBadge(status: Booking["status"]) {
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

export default async function ParentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const parent = await getParentById(id);

  if (!parent) {
    notFound();
  }

  const bookings = bookingList.filter(
    (b) => b.parentName === parent.name || b.parentPhone === parent.phone,
  );

  const bookingColumns: Column<Booking>[] = [
    {
      key: "teacherName",
      header: "老师",
      render: (b) => <span className="font-medium text-ink">{b.teacherName}</span>,
    },
    { key: "subject", header: "科目", render: (b) => b.subject },
    { key: "slot", header: "时段", render: (b) => b.slot },
    {
      key: "status",
      header: "状态",
      render: (b) => bookingStatusBadge(b.status),
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (b) => (
        <span className="text-ink/60">{formatDateTime(b.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <Link
        href="/parents"
        className="inline-flex items-center text-sm font-medium text-growth transition-colors hover:text-growth-deep"
      >
        ← 返回列表
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 基本信息 */}
        <Card title="基本信息" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-growth-soft text-xl font-semibold text-growth">
              {parent.avatar}
            </span>
            <div>
              <p className="text-lg font-semibold text-ink">{parent.name}</p>
              <p className="mt-1 font-mono text-sm text-ink/60">
                {parent.phone}
              </p>
            </div>
            {parent.status === "active" ? (
              <Badge variant="success">正常</Badge>
            ) : (
              <Badge variant="danger">已封禁</Badge>
            )}
          </div>
          <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/50">孩子学段</dt>
              <dd className="font-medium text-ink">{parent.childGrade}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/50">注册时间</dt>
              <dd className="text-ink">{formatDate(parent.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/50">收藏老师</dt>
              <dd className="font-mono text-ink">
                {parent.likedTeachers.length} 位
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/50">预约总数</dt>
              <dd className="font-mono text-ink">{parent.bookingCount} 次</dd>
            </div>
          </dl>
        </Card>

        {/* 偏好 + MBTI */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="筛选偏好">
            {parent.prefs ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-ink/10 bg-surface-soft p-3">
                  <p className="text-xs text-ink/50">学段</p>
                  <p className="mt-1 font-medium text-ink">
                    {parent.prefs.grade}
                  </p>
                </div>
                <div className="rounded-lg border border-ink/10 bg-surface-soft p-3">
                  <p className="text-xs text-ink/50">科目</p>
                  <p className="mt-1 font-medium text-ink">
                    {parent.prefs.subject}
                  </p>
                </div>
                <div className="rounded-lg border border-ink/10 bg-surface-soft p-3">
                  <p className="text-xs text-ink/50">预算</p>
                  <p className="mt-1 font-medium text-ink">
                    {budgetLabel(parent.prefs.budget)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink/40">未设置</p>
            )}
          </Card>

          <Card title="MBTI 测评结果">
            {parent.mbtiResult ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-ink/10 bg-growth-soft px-6 py-4">
                  <span className="font-mono text-3xl font-bold text-growth">
                    {parent.mbtiResult.code}
                  </span>
                  <span className="mt-1 text-xs text-growth-deep">类型代码</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {parent.mbtiResult.label}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/40">
                    教学建议
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {parent.mbtiResult.advice.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-ink/70"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-growth" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink/40">未测评</p>
            )}
          </Card>
        </div>
      </div>

      {/* 收藏老师 */}
      <Card title={`收藏老师（${parent.likedTeachers.length}）`}>
        {parent.likedTeachers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {parent.likedTeachers.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-ink/10 bg-surface-soft px-3 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">
                  {name.slice(0, 1)}
                </span>
                <span className="text-sm font-medium text-ink">{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="暂未收藏老师" />
        )}
      </Card>

      {/* 预约记录 */}
      <Card title={`预约记录（${bookings.length}）`}>
        <DataTable
          columns={bookingColumns}
          data={bookings}
          rowKey={(b) => b.id}
          empty={<EmptyState title="暂无预约记录" />}
        />
      </Card>
    </div>
  );
}

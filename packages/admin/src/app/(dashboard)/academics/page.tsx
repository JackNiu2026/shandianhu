"use client";
/**
 * V2.3 教务管理首页
 *
 * 概览统计：
 * - 待审核试听数（REQUESTED）
 * - 进行中课程数（SCHEDULED + IN_PROGRESS）
 * - 待反馈课程数（COMPLETED 且无 isCurrent 反馈）
 * - 本周评价数（ParentReview 本周创建）
 *
 * 管理员只读视图：不提供任何写操作，不代替老师/家长执行业务动作。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

interface AcademicsOverview {
  pendingTrialsCount: number;
  activeLessonsCount: number;
  lessonsAwaitingFeedback: number;
  reviewsThisWeek: number;
}

export default function AcademicsPage() {
  const [overview, setOverview] = useState<AcademicsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v2/admin/academics/overview");
        const json = await res.json();
        if (json?.ok) {
          setOverview(json.data as AcademicsOverview);
        } else {
          setError(json?.error?.message ?? "加载失败");
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">教务管理</h2>
        <div className="text-xs text-ink-muted">
          管理员只读概览：不代替老师或家长执行业务动作
        </div>
      </div>

      {/* 概览统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="待确认试听"
          value={overview?.pendingTrialsCount}
          loading={loading}
          href="/academics/trials"
          tone="amber"
        />
        <StatCard
          label="进行中课程"
          value={overview?.activeLessonsCount}
          loading={loading}
          href="/academics/lessons"
          tone="sky"
        />
        <StatCard
          label="待反馈课程"
          value={overview?.lessonsAwaitingFeedback}
          loading={loading}
          href="/academics/feedback"
          tone="violet"
        />
        <StatCard
          label="本周评价数"
          value={overview?.reviewsThisWeek}
          loading={loading}
          href="/academics/lessons"
          tone="emerald"
        />
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-4">
          加载失败：{error}
        </div>
      ) : null}

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl border border-ink/5 p-4">
        <div className="text-sm font-semibold text-ink mb-3">快捷入口</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <QuickLink href="/academics/trials" label="试听监督" description="查看试听进度、双方操作与异常状态" />
          <QuickLink href="/academics/lessons" label="课程管理" description="查看所有课程及状态" />
          <QuickLink href="/academics/feedback" label="反馈管理" description="查看老师结构化反馈（含私有备注）" />
          <QuickLink href="/teachers" label="老师审核" description="资质审核与状态管理" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  href,
  tone,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  href: string;
  tone: "amber" | "sky" | "violet" | "emerald";
}) {
  const toneClass = {
    amber: "border-amber-300 bg-amber-50",
    sky: "border-sky-300 bg-sky-50",
    violet: "border-violet-300 bg-violet-50",
    emerald: "border-emerald-300 bg-emerald-50",
  }[tone];
  return (
    <Link
      href={href}
      className={`block rounded-xl border-2 ${toneClass} p-4 transition hover:shadow-md`}
    >
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink">
        {loading ? "—" : value ?? 0}
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-indigo-300 hover:bg-indigo-50"
    >
      <div className="font-medium text-ink">{label}</div>
      <div className="mt-1 text-xs text-ink-muted">{description}</div>
    </Link>
  );
}

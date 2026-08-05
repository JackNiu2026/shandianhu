"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { StatCard, Card, CardHeader } from "@/components/ui";
import { PieChartComponent } from "@/components/charts/pie_chart";
import { RatingChart } from "@/components/charts/rating_chart";
import { formatCurrency } from "@/lib/utils";
import { getDashboardStats } from "@/lib/data";

interface DashboardStats {
  teacherCount: number;
  parentCount: number;
  bookingCount: number;
  totalRevenue: number;
  pendingReviews: number;
  pendingBookings: number;
  pendingTeachers: number;
  activeMemberships: number;
  subjectDistribution: { name: string; count: number }[];
  ratingDistribution: { name: string; count: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardStats()
      .then((data) => { setStats(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-12 text-ink-muted">加载中...</div>;
  if (error) return <div className="text-center py-12 text-danger">{error}</div>;
  if (!stats) return <div className="text-center py-12 text-ink-muted">暂无数据</div>;

  return (
    <div>
      <Breadcrumb />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="老师总数" value={stats.teacherCount} icon="👨‍🏫" />
        <StatCard label="家长总数" value={stats.parentCount} icon="👨‍👩‍👧" />
        <StatCard label="预约总数" value={stats.bookingCount} icon="📅" />
        <StatCard label="平台总收入" value={formatCurrency(stats.totalRevenue)} icon="💰" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="待审核老师" value={stats.pendingTeachers} icon="⏳" />
        <StatCard label="待处理预约" value={stats.pendingBookings} icon="📋" />
        <StatCard label="待审核评价" value={stats.pendingReviews} icon="⭐" />
        <StatCard label="活跃会员" value={stats.activeMemberships} icon="🎟️" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="科目分布" />
          <PieChartComponent
            data={stats.subjectDistribution.map((s) => ({ name: s.name, value: s.count }))}
          />
        </Card>

        <Card>
          <CardHeader title="老师评分分布" />
          <RatingChart data={stats.ratingDistribution} />
        </Card>
      </div>
    </div>
  );
}

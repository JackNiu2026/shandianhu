import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import StatCard from "@/components/ui/stat_card";
import TrendChart from "@/components/charts/trend_chart";
import RevenueChart from "@/components/charts/revenue_chart";
import PieChart from "@/components/charts/pie_chart";
import RatingChart from "@/components/charts/rating_chart";
import {
  getDashboardStats,
  monthlyRevenue,
  subjectDistribution,
  ratingDistribution,
  bookingList,
} from "@/lib/data";
import { formatCurrency, timeAgo, statusToVariant } from "@/lib/utils";
import type { BookingStatus } from "@/lib/types";

const bookingStatusLabels: Record<BookingStatus, string> = {
  pending: "待确认",
  confirmed: "已确认",
  completed: "已完成",
  cancelled: "已取消",
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  // 近期活动：取最新 5 条预约
  const recentBookings = [...bookingList]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-sm text-ink-muted mt-1">
          平台整体运营数据概览与趋势分析
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="👥" label="老师总数" value={stats.teacherCount} />
        <StatCard icon="👨‍👩‍👧" label="家长总数" value={stats.parentCount} />
        <StatCard icon="📅" label="本月预约" value={stats.bookingCount} />
        <StatCard
          icon="💰"
          label="平台总收入"
          value={formatCurrency(stats.totalRevenue)}
        />
      </div>

      {/* 图表区域 1：趋势 + 收益 */}
      <div className="grid grid-cols-2 gap-6">
        <Card title="月度预约趋势">
          <TrendChart data={monthlyRevenue} />
        </Card>
        <Card title="月度收益">
          <RevenueChart data={monthlyRevenue} />
        </Card>
      </div>

      {/* 图表区域 2：科目分布 + 评分分布 */}
      <div className="grid grid-cols-2 gap-6">
        <Card title="科目分布">
          <PieChart data={subjectDistribution} />
        </Card>
        <Card title="评分分布">
          <RatingChart data={ratingDistribution} />
        </Card>
      </div>

      {/* 近期活动 + 待处理事项 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 近期活动 */}
        <Card title="近期活动">
          <div className="space-y-4">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between gap-3 pb-4 border-b border-ink-muted/20 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {booking.parentName}
                    <span className="text-ink-muted mx-1">→</span>
                    {booking.teacherName}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {booking.subject} · {booking.slot}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={statusToVariant(booking.status)}>
                    {bookingStatusLabels[booking.status]}
                  </Badge>
                  <span className="text-xs text-ink-muted">
                    {timeAgo(booking.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 待处理事项 */}
        <Card title="待处理事项">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-notice-soft border-2 border-notice">
              <div className="flex items-center gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="text-sm font-bold text-ink">待审核老师</p>
                  <p className="text-xs text-ink-muted">需要资质核验</p>
                </div>
              </div>
              <span className="text-2xl font-bold font-mono text-notice">
                {stats.pendingTeachers}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-notice-soft border-2 border-notice">
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-ink">待确认预约</p>
                  <p className="text-xs text-ink-muted">家长发起的预约请求</p>
                </div>
              </div>
              <span className="text-2xl font-bold font-mono text-notice">
                {stats.pendingBookings}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-notice-soft border-2 border-notice">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <p className="text-sm font-bold text-ink">待审核评价</p>
                  <p className="text-xs text-ink-muted">家长提交的评价</p>
                </div>
              </div>
              <span className="text-2xl font-bold font-mono text-notice">
                {stats.pendingReviews}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import { getTeacherById } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TeacherStatus } from "@/lib/types";

const statusConfig: Record<
  TeacherStatus,
  { label: string; variant: "success" | "notice" | "danger" }
> = {
  active: { label: "已上线", variant: "success" },
  pending: { label: "待审核", variant: "notice" },
  blocked: { label: "已封禁", variant: "danger" },
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await getTeacherById(id);

  if (!teacher) {
    notFound();
  }

  const statusCfg = statusConfig[teacher.status];

  // 基本信息表格数据
  const basicInfo: { label: string; value: string }[] = [
    { label: "姓名", value: teacher.name },
    { label: "年龄", value: teacher.age },
    { label: "科目", value: teacher.subject },
    { label: "学段", value: teacher.grades.join(" / ") },
    { label: "教学模式", value: teacher.mode },
    { label: "课时价格", value: `${formatCurrency(teacher.price)} / 课时` },
    { label: "教龄", value: teacher.years },
    { label: "学生数", value: `${teacher.students} 人` },
    { label: "评分", value: `${teacher.rating} ⭐` },
    { label: "创建时间", value: formatDate(teacher.createdAt) },
  ];

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Link
        href="/teachers"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
      >
        ← 返回列表
      </Link>

      {/* 老师信息卡片 */}
      <Card>
        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-xl grid place-items-center text-2xl font-bold text-ink shrink-0 border-2 border-ink shadow-nb-sm"
            style={{ backgroundColor: teacher.color }}
          >
            {teacher.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{teacher.name}</h1>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-ink-muted mt-1">{teacher.school}</p>
            {teacher.note && (
              <p className="text-sm text-ink mt-2 italic">
                &ldquo;{teacher.note}&rdquo;
              </p>
            )}
            {teacher.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {teacher.tags.map((tag) => (
                  <Badge key={tag} variant="primary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 收益统计 + 核验项管理 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 收益统计 */}
        <Card title="收益统计">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">总收益</p>
              <p className="text-2xl font-bold font-mono text-ink">
                {formatCurrency(teacher.totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">待入账</p>
              <p className="text-2xl font-bold font-mono text-notice">
                {formatCurrency(teacher.pendingRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">可提现</p>
              <p className="text-2xl font-bold font-mono text-success">
                {formatCurrency(teacher.availableRevenue)}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-ink-muted/20 flex items-center justify-between text-sm">
            <span className="text-ink-muted">累计课时</span>
            <span className="font-mono font-bold">{teacher.totalLessons} 节</span>
          </div>
        </Card>

        {/* 核验项管理 */}
        <Card title="核验项管理">
          <div className="space-y-3">
            {teacher.checks.length > 0 ? (
              teacher.checks.map((check) => (
                <div
                  key={check}
                  className="flex items-center justify-between p-3 rounded-lg bg-success-soft border-2 border-success"
                >
                  <span className="text-sm font-medium text-ink">{check}</span>
                  <Badge variant="success">✅ 已通过</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-muted text-center py-4">
                暂无核验项
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* 可约时段 + 评价列表 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 可约时段 */}
        <Card title="可约时段">
          <div className="space-y-2">
            {teacher.slots.length > 0 ? (
              teacher.slots.map((slot) => (
                <div
                  key={slot}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-soft border-2 border-ink-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {slot}
                    </span>
                  </div>
                  <button className="px-2.5 py-1 rounded-md border-2 border-danger bg-danger-soft text-danger text-xs font-semibold transition-all hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer">
                    删除
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-muted text-center py-4">
                暂无可约时段
              </p>
            )}
          </div>
        </Card>

        {/* 评价列表 */}
        <Card title="评价列表">
          <div className="space-y-4">
            {teacher.reviews.length > 0 ? (
              teacher.reviews.map((review, i) => (
                <div
                  key={i}
                  className="pb-4 border-b border-ink-muted/20 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-bold text-ink">{review.by}</p>
                  <p className="text-sm text-ink-muted mt-1">{review.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-muted text-center py-4">
                暂无评价
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* 基本信息表格 */}
      <Card title="基本信息">
        <div className="grid grid-cols-2 gap-x-8 gap-y-0">
          {basicInfo.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-ink-muted/15"
            >
              <span className="text-sm text-ink-muted">{item.label}</span>
              <span className="text-sm font-semibold text-ink">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

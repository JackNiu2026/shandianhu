import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 主标签（label 的别名） */
  label?: string;
  title?: string;
  value: string | number;
  /** 趋势文本（hint 的别名） */
  trend?: string;
  hint?: string;
  /** emoji 图标，可选 */
  icon?: string;
}

function getTrendColor(trend: string): string {
  const trimmed = trend.trim();
  if (trimmed.startsWith("-")) return "text-danger";
  return "text-success";
}

/**
 * Neo-brutalism 统计卡片
 * - border-2 border-ink rounded-xl bg-surface-paper shadow-nb p-5
 * - icon 在左上角（可选），value 用 text-3xl font-black font-mono
 * - trend/hint 用 success 或 danger 色
 * - 支持 title/hint 别名以兼容不同页面调用
 */
function StatCard({
  label,
  title,
  value,
  trend,
  hint,
  icon,
  className,
  ...props
}: StatCardProps) {
  const displayLabel = title ?? label ?? "";
  const displayHint = hint ?? trend;

  return (
    <div
      className={cn(
        "border-2 border-ink rounded-xl bg-surface-paper shadow-nb p-5",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        {icon && <div className="text-3xl leading-none">{icon}</div>}
        {displayHint && (
          <span
            className={cn(
              "text-sm font-bold",
              trend ? getTrendColor(trend) : "text-ink-muted",
            )}
          >
            {displayHint}
          </span>
        )}
      </div>
      <div className={cn(!icon && !displayHint && "mt-0", "mt-4")}>
        <p className="text-sm font-medium text-ink-muted">{displayLabel}</p>
        <p className="mt-1 text-3xl font-black font-mono text-ink">{value}</p>
      </div>
    </div>
  );
}

export default StatCard;
export { StatCard };

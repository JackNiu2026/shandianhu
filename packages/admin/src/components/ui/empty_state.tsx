import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: string;
  title: string;
  description?: string;
}

/**
 * Neo-brutalism 空状态
 * - 接收 icon(字符串默认 "📭"), title, description?
 * - 居中显示，border-2 border-dashed border-ink-muted/40 rounded-xl p-12
 */
function EmptyState({
  icon = "📭",
  title,
  description,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center border-2 border-dashed border-ink-muted/40 rounded-xl p-12",
        className,
      )}
      {...props}
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-ink-muted max-w-sm">{description}</p>
      )}
    </div>
  );
}

export default EmptyState;
export { EmptyState };

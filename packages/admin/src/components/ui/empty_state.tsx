import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message?: string;
  icon?: string;
  className?: string;
}

export function EmptyState({
  message = "暂无数据",
  icon = "📋",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}

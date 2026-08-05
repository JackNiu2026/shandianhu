import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 text-sm border-2 border-ink rounded-lg disabled:opacity-30 hover:bg-surface-soft"
      >
        上一页
      </button>
      <span className="text-sm text-ink-muted">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 text-sm border-2 border-ink rounded-lg disabled:opacity-30 hover:bg-surface-soft"
      >
        下一页
      </button>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** 当前页码（currentPage 的别名） */
  page?: number;
  currentPage?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 总条数（用于计算总页数） */
  total?: number;
  /** 总页数（直接指定，优先于 total/pageSize 计算） */
  totalPages?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Neo-brutalism 分页组件
 * - 上一页/下一页按钮 + 页码显示
 * - 支持 page/pageSize/total 或 currentPage/totalPages 两种 API
 */
function Pagination({
  page,
  currentPage,
  pageSize,
  total,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const resolvedCurrent = page ?? currentPage ?? 1;
  const resolvedTotalPages = totalPages ?? (total && pageSize ? Math.ceil(total / pageSize) : 0);

  if (resolvedTotalPages <= 0) return null;

  const canPrev = resolvedCurrent > 1;
  const canNext = resolvedCurrent < resolvedTotalPages;

  const buttonBase =
    "inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-lg border-2 border-ink font-semibold transition-all cursor-pointer select-none";

  const activeButton = cn(
    buttonBase,
    "bg-white text-ink shadow-nb-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  );

  const disabledButton = cn(
    buttonBase,
    "bg-surface-soft text-ink-muted opacity-50 pointer-events-none",
  );

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <button
        onClick={() => canPrev && onPageChange(resolvedCurrent - 1)}
        disabled={!canPrev}
        className={canPrev ? activeButton : disabledButton}
      >
        上一页
      </button>

      <span className="text-sm font-semibold text-ink px-2">
        第 <span className="font-mono">{resolvedCurrent}</span> /{" "}
        <span className="font-mono">{resolvedTotalPages}</span> 页
      </span>

      <button
        onClick={() => canNext && onPageChange(resolvedCurrent + 1)}
        disabled={!canNext}
        className={canNext ? activeButton : disabledButton}
      >
        下一页
      </button>
    </div>
  );
}

export default Pagination;
export { Pagination };

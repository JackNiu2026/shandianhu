"use client";

import { cn } from "@/lib/utils";
import { EmptyState } from "./empty_state";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyMessage,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-ink-muted">加载中...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState message={emptyMessage || "暂无数据"} />;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-2 border-ink rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-surface-soft border-b-2 border-ink">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-sm font-medium text-ink",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-ink/20",
                i % 2 === 0 ? "bg-surface-paper" : "bg-surface-soft/50",
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 text-sm", col.className)}>
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

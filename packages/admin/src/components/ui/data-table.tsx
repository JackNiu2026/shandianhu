import * as React from "react";
import { cn } from "@/lib/utils";
import EmptyState from "./empty_state";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  className?: string;
}

const alignClass: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Neo-brutalism 数据表格
 * - border-2 border-ink rounded-xl overflow-hidden shadow-nb
 * - 表头 bg-surface-soft border-b-2 border-ink font-bold
 * - 行 hover bg-surface-soft/50，支持 onRowClick
 * - 支持 align 对齐方式
 * - 空数据显示 EmptyState
 */
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  empty,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "border-2 border-ink rounded-xl overflow-hidden bg-surface-paper shadow-nb",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-soft border-b-2 border-ink">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-sm font-bold text-ink whitespace-nowrap",
                    col.align ? alignClass[col.align] : "text-left",
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8">
                  {empty || <EmptyState title="暂无数据" />}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-ink-muted/20 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-surface-soft/50",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-sm text-ink",
                        col.align ? alignClass[col.align] : "text-left",
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row, index)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DataTable };

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  value: string;
  /** 可选数量徽章 */
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Neo-brutalism 标签页
 * - 选中态：border-2 border-ink bg-growth text-white shadow-nb-sm
 * - 未选中：bg-surface-soft
 * - px-4 py-2 rounded-lg font-semibold text-sm
 * - 支持 count 数量徽章
 */
function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "px-4 py-2 rounded-lg font-semibold text-sm border-2 transition-all inline-flex items-center gap-2",
              isActive
                ? "border-ink bg-growth text-white shadow-nb-sm"
                : "border-transparent bg-surface-soft text-ink hover:bg-surface-base",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold",
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-ink/10 text-ink",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
export { Tabs };

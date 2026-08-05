"use client";

import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 border-b-2 border-ink", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-2 border-b-0 rounded-t-lg transition-all",
            active === tab.value
              ? "bg-growth text-white border-ink -mb-[2px]"
              : "bg-transparent text-ink-muted border-transparent hover:bg-surface-soft",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

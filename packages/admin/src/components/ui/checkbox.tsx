"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  disabled?: boolean;
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Neo-brutalism 复选框
 * - 方形 border-2 border-ink，选中时 bg-growth text-white
 * - onChange 不带参数（切换语义）
 */
export default function Checkbox({
  label,
  checked,
  onChange,
  className,
  disabled,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          onChange();
        }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border-2 border-ink shadow-nb-sm transition-all",
          checked
            ? "bg-growth text-white"
            : "bg-surface-paper text-transparent",
        )}
      >
        <CheckIcon />
      </span>
      <span>{label}</span>
    </label>
  );
}

export { Checkbox };

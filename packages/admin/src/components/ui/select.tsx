import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Neo-brutalism 下拉选择
 * - border-2 border-ink bg-surface-paper rounded-lg shadow-nb-sm
 * - focus 时 translate + shadow-none
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full appearance-none rounded-lg border-2 border-ink bg-surface-paper px-4 py-2 pr-9 text-sm text-ink shadow-nb-sm outline-none transition-all focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none disabled:opacity-50",
              error && "border-danger",
              className,
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown />
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

export default Select;

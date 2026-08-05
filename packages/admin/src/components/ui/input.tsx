import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Neo-brutalism 输入框
 * - border-2 border-ink bg-surface-paper rounded-lg shadow-nb-sm
 * - focus 时 translate + shadow-none（按压效果）
 * - 可选 label / error
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-lg border-2 border-ink bg-surface-paper px-4 py-2 text-sm text-ink placeholder:text-ink-muted/60 shadow-nb-sm outline-none transition-all focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none disabled:opacity-50",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export default Input;

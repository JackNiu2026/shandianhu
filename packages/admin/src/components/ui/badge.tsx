import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "notice"
  | "danger"
  | "primary";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-soft text-ink-muted border-ink-muted/30",
  success: "bg-success-soft text-success border-success/40",
  notice: "bg-notice-soft text-notice border-notice/40",
  danger: "bg-danger-soft text-danger border-danger/40",
  primary: "bg-growth-soft text-growth border-growth/40",
};

export default function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };

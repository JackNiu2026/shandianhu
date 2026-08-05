import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "notice" | "danger" | "default" | "primary";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: "bg-success-soft text-success border-success",
  notice: "bg-notice-soft text-notice border-notice",
  danger: "bg-danger/10 text-danger border-danger",
  default: "bg-surface-soft text-ink-muted border-ink-muted",
  primary: "bg-growth/10 text-growth border-growth",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

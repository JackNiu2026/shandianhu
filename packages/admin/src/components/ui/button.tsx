import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "danger" | "success" | "action";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  href?: string;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface-paper text-ink",
  primary: "bg-growth text-white",
  danger: "bg-danger text-white",
  success: "bg-success text-white",
  action: "bg-action text-ink",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1 rounded-md",
  md: "text-sm px-4 py-2 rounded-lg",
  lg: "text-base px-5 py-2.5 rounded-lg",
};

export default function Button({
  variant = "default",
  size = "md",
  asChild = false,
  href,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-1.5 border-2 border-ink font-semibold shadow-nb-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-nb-sm",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (asChild && href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export { Button };

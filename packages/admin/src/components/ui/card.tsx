import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}

/**
 * Neo-brutalism 卡片
 * - border-2 border-ink rounded-xl bg-surface-paper shadow-nb
 */
export default function Card({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: CardProps) {
  return (
    <div
      className={cn(
        "border-2 border-ink rounded-xl bg-surface-paper shadow-nb",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-4">
          <div>
            {title && (
              <h3 className="text-base font-bold text-ink">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

export { Card };

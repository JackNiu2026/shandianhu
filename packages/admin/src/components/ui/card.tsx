import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function Card({ className, children, title, description }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface-paper border-2 border-ink rounded-xl shadow-nb p-5",
        className,
      )}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {action}
    </div>
  );
}

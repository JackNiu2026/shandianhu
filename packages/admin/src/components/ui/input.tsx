import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      )}
      <input
        className={cn(
          "w-full px-3 py-2 border-2 border-ink rounded-lg bg-white",
          "focus:outline-none focus:shadow-nb-sm transition-shadow",
          "placeholder:text-ink-muted/50",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

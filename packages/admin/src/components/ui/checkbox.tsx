import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <label
      className={cn("flex items-center gap-2 cursor-pointer", className)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-growth border-2 border-ink rounded"
      />
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

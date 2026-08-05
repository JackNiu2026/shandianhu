"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className={cn(
          "relative bg-surface-paper border-2 border-ink rounded-xl shadow-nb-lg p-6 w-full max-w-md",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink text-xl"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

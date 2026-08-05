"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  /** 是否打开（isOpen 的别名） */
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Neo-brutalism 模态框
 * - 固定全屏遮罩 bg-black/40 + 居中弹窗
 * - 弹窗：bg-surface-paper border-2 border-ink rounded-xl shadow-nb-lg p-6
 * - animate-dialog-pop 入场动画
 * - 右上角关闭按钮
 * - 支持 open/isOpen, title, description, children, footer
 */
function Modal({
  open,
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const visible = open ?? isOpen ?? false;

  // ESC 键关闭
  React.useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative bg-surface-paper border-2 border-ink rounded-xl shadow-nb-lg p-6 animate-dialog-pop max-w-lg w-full",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg border-2 border-ink bg-white hover:bg-surface-soft transition-colors font-bold text-ink"
        >
          ✕
        </button>

        {title && (
          <h2 className="text-xl font-bold mb-2 pr-8">{title}</h2>
        )}

        {description && (
          <p className="text-sm text-ink-muted mb-4">{description}</p>
        )}

        {children && <div className="mb-4">{children}</div>}

        {footer && (
          <div className="flex justify-end gap-2 mt-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default Modal;
export { Modal };

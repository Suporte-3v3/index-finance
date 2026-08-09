/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import { cn } from "./cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-brand-navy-950/50 backdrop-blur-[2px] motion-safe:animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full max-h-[90vh] flex flex-col rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark shadow-2xl outline-none",
          "motion-safe:animate-[modalIn_180ms_ease-out]",
          SIZE_CLASSES[size],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 p-5 border-b border-line dark:border-line-dark shrink-0">
            <div className="space-y-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-bold text-ink dark:text-ink-dark tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              icon={<X className="h-4 w-4" />}
              label="Fechar"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        )}
        <div className="overflow-y-auto p-5 flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-line dark:border-line-dark shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

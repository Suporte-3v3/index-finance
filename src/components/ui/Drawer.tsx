/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import { cn } from "./cn";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  side?: "right" | "left";
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}

export default function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  widthClassName = "w-full max-w-sm",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-brand-navy-950/50 motion-safe:animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative h-full flex flex-col bg-surface dark:bg-surface-dark border-line dark:border-line-dark shadow-2xl outline-none",
          side === "right"
            ? "ml-auto border-l motion-safe:animate-[drawerInRight_200ms_ease-out]"
            : "mr-auto border-r motion-safe:animate-[drawerInLeft_200ms_ease-out]",
          widthClassName,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 p-4 border-b border-line dark:border-line-dark shrink-0">
            <h2 className="text-sm font-bold text-ink dark:text-ink-dark tracking-tight">
              {title}
            </h2>
            <IconButton
              icon={<X className="h-4 w-4" />}
              label="Fechar"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
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

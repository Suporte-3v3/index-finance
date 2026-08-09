/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: ReactElement<{ onClick?: React.MouseEventHandler }>;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

// Menu de ações genérico (perfil, ações de linha de tabela...). Fecha ao clicar
// fora, ao pressionar Esc, ou ao escolher um item.
export default function Dropdown({
  trigger,
  items,
  align = "right",
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {React.cloneElement(trigger, {
        onClick: (event: React.MouseEvent) => {
          trigger.props.onClick?.(event);
          setOpen((value) => !value);
        },
      })}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-2 min-w-48 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark shadow-lg p-1.5 motion-safe:animate-[popIn_120ms_ease-out] origin-top",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                item.danger
                  ? "text-brand-red-600 hover:bg-brand-red-50 dark:hover:bg-brand-red-600/10"
                  : "text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-white/5",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

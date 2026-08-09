/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-canvas dark:bg-white/5 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              active
                ? "bg-surface dark:bg-surface-dark text-brand-navy-900 dark:text-ink-dark shadow-sm"
                : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark",
            )}
          >
            {item.label}
            {item.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  active
                    ? "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/20"
                    : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-ink-soft-dark",
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

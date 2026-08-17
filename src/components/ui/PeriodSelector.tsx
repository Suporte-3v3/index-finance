/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "./cn";
import BrazilianDateInput from "./BrazilianDateInput";

export type PeriodValue = "7" | "15" | "30" | "90" | "custom";

const OPTIONS: { value: PeriodValue; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
];

export interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
  className?: string;
}

export default function PeriodSelector({
  value,
  onChange,
  customStart = "",
  customEnd = "",
  onCustomChange,
  className,
}: PeriodSelectorProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex items-center gap-1 rounded-xl bg-canvas dark:bg-white/5 p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              value === option.value
                ? "bg-surface dark:bg-surface-dark text-brand-navy-900 dark:text-ink-dark shadow-sm"
                : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === "custom" && onCustomChange && (
        <div className="flex items-center gap-1.5">
          <BrazilianDateInput
            value={customStart}
            onValueChange={(date) => onCustomChange(date, customEnd)}
            className="h-9 rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark px-2.5 text-xs text-ink dark:text-ink-dark dark:[color-scheme:dark]"
          />
          <span className="text-ink-soft dark:text-ink-soft-dark text-xs">a</span>
          <BrazilianDateInput
            value={customEnd}
            onValueChange={(date) => onCustomChange(customStart, date)}
            className="h-9 rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark px-2.5 text-xs text-ink dark:text-ink-dark dark:[color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}

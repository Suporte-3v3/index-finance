/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  stroke?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  valueFormatter?: (value: number) => string;
}

const defaultFormatter = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Tooltip Recharts customizado (renderiza fora do SVG, então pode usar as
// classes claro/escuro normais do design system em vez do contentStyle inline).
export default function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter = defaultFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-40 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark shadow-lg px-3.5 py-2.5 text-xs">
      {label !== undefined && (
        <p className="mb-1.5 border-b border-line dark:border-line-dark pb-1.5 font-bold text-ink dark:text-ink-dark">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-soft dark:text-ink-soft-dark">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-ink dark:text-ink-dark">
              {typeof entry.value === "number"
                ? valueFormatter(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

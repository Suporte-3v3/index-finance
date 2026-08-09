/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Card from "./Card";
import Tooltip from "./Tooltip";
import { cn } from "./cn";

export type MetricTone = "neutral" | "navy" | "red" | "green" | "gold";

export interface MetricTrend {
  label: string;
  direction: "up" | "down" | "flat";
  // Nem toda alta é positiva (ex.: saídas subindo é ruim) — quem chama decide.
  positive?: boolean;
}

export interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: MetricTrend;
  helpText?: string;
  tooltip?: string;
  tone?: MetricTone;
  onClick?: () => void;
  actions?: ReactNode;
  className?: string;
  id?: string;
}

const TONE_CHIP: Record<MetricTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-ink-soft-dark",
  navy: "bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90",
  red: "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/15 dark:text-red-300",
  green:
    "bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300",
  gold: "bg-brand-gold-300/25 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300",
};

const TREND_CLASSES = (trend: MetricTrend) => {
  if (trend.direction === "flat") return "text-ink-soft dark:text-ink-soft-dark";
  const isGood = trend.positive ?? trend.direction === "up";
  return isGood
    ? "text-brand-green-600 dark:text-emerald-400"
    : "text-brand-red-600 dark:text-red-400";
};

export default function MetricCard({
  icon,
  label,
  value,
  trend,
  helpText,
  tooltip,
  tone = "navy",
  onClick,
  actions,
  className,
  id,
}: MetricCardProps) {
  const TrendIcon =
    trend?.direction === "up"
      ? ArrowUpRight
      : trend?.direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <Card
      id={id}
      interactive={Boolean(onClick)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn("space-y-3", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 [&_svg]:h-4.5 [&_svg]:w-4.5",
            TONE_CHIP[tone],
          )}
        >
          {icon}
        </div>
        {actions}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark truncate">
            {label}
          </p>
          {tooltip && <Tooltip content={tooltip} />}
        </div>
        <p className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight tabular-nums">
          {value}
        </p>
      </div>
      {(trend || helpText) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                TREND_CLASSES(trend),
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {trend.label}
            </span>
          )}
          {helpText && (
            <span className="text-ink-soft dark:text-ink-soft-dark truncate">
              {helpText}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

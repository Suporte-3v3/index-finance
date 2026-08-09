/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "navy" | "red" | "green" | "gold";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-ink-soft-dark",
  navy: "bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90",
  red: "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/15 dark:text-red-300",
  green:
    "bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300",
  gold: "bg-brand-gold-300/25 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-400",
  navy: "bg-brand-navy-900 dark:bg-brand-navy-700",
  red: "bg-brand-red-600",
  green: "bg-brand-green-600",
  gold: "bg-brand-gold-600",
};

export default function Badge({
  tone = "neutral",
  children,
  icon,
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_CLASSES[tone])}
        />
      )}
      {icon}
      {children}
    </span>
  );
}

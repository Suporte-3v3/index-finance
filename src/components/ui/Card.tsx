/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
  interactive?: boolean;
  children: ReactNode;
}

export default function Card({
  padding = true,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark shadow-[0_1px_2px_rgba(23,32,51,0.05)]",
        padding && "p-5",
        interactive &&
          "transition-colors hover:border-brand-navy-700/40 dark:hover:border-brand-navy-700/40 cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="space-y-0.5 min-w-0">
        <h3 className="text-sm font-bold text-ink dark:text-ink-dark tracking-tight truncate">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:text-ink-soft-dark",
        className,
      )}
    >
      {children}
    </p>
  );
}

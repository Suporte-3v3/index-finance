/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-12 px-6",
        className,
      )}
    >
      <div className="h-12 w-12 rounded-full bg-canvas dark:bg-white/5 flex items-center justify-center text-ink-soft dark:text-ink-soft-dark [&_svg]:h-5 [&_svg]:w-5">
        {icon || <Inbox aria-hidden="true" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="text-sm font-bold text-ink dark:text-ink-dark">{title}</p>
        {description && (
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

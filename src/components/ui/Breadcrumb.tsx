/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1.5 min-w-0">
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-ink-soft dark:text-ink-soft-dark hover:text-brand-navy-900 dark:hover:text-brand-gold-300 font-medium truncate cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={
                  isLast
                    ? "font-bold text-ink dark:text-ink-dark truncate"
                    : "text-ink-soft dark:text-ink-soft-dark truncate"
                }
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight
                className="h-3 w-3 text-ink-soft/60 dark:text-ink-soft-dark/60 shrink-0"
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}

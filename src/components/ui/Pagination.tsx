/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import IconButton from "./IconButton";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  totalLabel?: string;
}

export default function Pagination({
  page,
  pageCount,
  onChange,
  totalLabel,
}: PaginationProps) {
  if (pageCount <= 1 && !totalLabel) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line dark:border-line-dark text-xs text-ink-soft dark:text-ink-soft-dark">
      <span>{totalLabel}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <IconButton
            icon={<ChevronLeft className="h-4 w-4" />}
            label="Página anterior"
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          />
          <span className="font-semibold text-ink dark:text-ink-dark tabular-nums">
            {page} / {pageCount}
          </span>
          <IconButton
            icon={<ChevronRight className="h-4 w-4" />}
            label="Próxima página"
            size="sm"
            variant="ghost"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
          />
        </div>
      )}
    </div>
  );
}

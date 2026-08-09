/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "./cn";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
}

export default function SearchField({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  containerClassName,
  ...rest
}: SearchFieldProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft dark:text-ink-soft-dark pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark pl-9 pr-9 text-sm text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 focus:border-brand-navy-700",
          className,
        )}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import Field, { fieldBorderClass } from "./Field";
import { cn } from "./cn";

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export default function SelectField({
  label,
  required,
  hint,
  error,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <div className="relative">
          <select
            id={id}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "h-10 w-full appearance-none rounded-lg border bg-surface dark:bg-surface-dark pl-3 pr-9 text-sm text-ink dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:[color-scheme:dark]",
              fieldBorderClass(error),
              className,
            )}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft dark:text-ink-soft-dark" />
        </div>
      )}
    </Field>
  );
}

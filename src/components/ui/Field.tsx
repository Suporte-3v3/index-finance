/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, useId } from "react";
import { cn } from "./cn";

export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

// Envelope compartilhado por TextField/SelectField/DateField: label visível,
// marcação de obrigatório, texto auxiliar e mensagem de erro próxima ao campo.
export default function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-bold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark block"
        >
          {label} {required && <span className="text-brand-red-600">*</span>}
        </label>
      )}
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-semibold text-brand-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export const FIELD_INPUT_CLASS =
  "h-10 w-full rounded-lg border bg-surface dark:bg-surface-dark px-3 text-sm text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 disabled:opacity-50 disabled:cursor-not-allowed dark:[color-scheme:dark]";

export const fieldBorderClass = (error?: string) =>
  error
    ? "border-brand-red-600 focus:border-brand-red-600"
    : "border-line dark:border-line-dark focus:border-brand-navy-700";

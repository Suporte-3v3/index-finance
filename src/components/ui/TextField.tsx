/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes, ReactNode } from "react";
import Field, { FIELD_INPUT_CLASS, fieldBorderClass } from "./Field";
import { cn } from "./cn";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export default function TextField({
  label,
  required,
  hint,
  error,
  icon,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft dark:text-ink-soft-dark pointer-events-none [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </span>
          )}
          <input
            id={id}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              FIELD_INPUT_CLASS,
              fieldBorderClass(error),
              icon && "pl-9",
              className,
            )}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes } from "react";
import Field, { FIELD_INPUT_CLASS, fieldBorderClass } from "./Field";
import { cn } from "./cn";

export interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function DateField({
  label,
  required,
  hint,
  error,
  className,
  ...rest
}: DateFieldProps) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          type="date"
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(FIELD_INPUT_CLASS, fieldBorderClass(error), className)}
          {...rest}
        />
      )}
    </Field>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { brazilianDateToIso, isoDateToBrazilian, maskBrazilianDate } from "../../services/dateFormatters";
import { cn } from "./cn";

export interface BrazilianDateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  onValueChange: (isoDate: string) => void;
}

export default function BrazilianDateInput({
  value = "",
  onValueChange,
  className,
  placeholder = "DD-MM-AAAA",
  onBlur,
  onFocus,
  ...rest
}: BrazilianDateInputProps) {
  const focused = useRef(false);
  const [displayValue, setDisplayValue] = useState(() => isoDateToBrazilian(value));

  useEffect(() => {
    if (!focused.current) setDisplayValue(isoDateToBrazilian(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      maxLength={10}
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      className={cn("font-mono", className)}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const masked = maskBrazilianDate(event.target.value);
        setDisplayValue(masked);
        const isoDate = brazilianDateToIso(masked);
        event.currentTarget.setCustomValidity(masked && !isoDate ? "Use uma data válida no formato DD-MM-AAAA." : "");
        onValueChange(isoDate ?? "");
      }}
      onBlur={(event) => {
        focused.current = false;
        const isoDate = brazilianDateToIso(displayValue);
        event.currentTarget.setCustomValidity(displayValue && !isoDate ? "Use uma data válida no formato DD-MM-AAAA." : "");
        onBlur?.(event);
      }}
    />
  );
}

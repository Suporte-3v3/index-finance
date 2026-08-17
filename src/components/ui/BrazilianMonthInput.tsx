/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { brazilianMonthToIso, isoMonthToBrazilian, maskBrazilianMonth } from "../../services/dateFormatters";
import { cn } from "./cn";

export interface BrazilianMonthInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  onValueChange: (isoMonth: string) => void;
}

export default function BrazilianMonthInput({
  value = "",
  onValueChange,
  className,
  placeholder = "MM-AAAA",
  onBlur,
  onFocus,
  ...rest
}: BrazilianMonthInputProps) {
  const focused = useRef(false);
  const [displayValue, setDisplayValue] = useState(() => isoMonthToBrazilian(value));

  useEffect(() => {
    if (!focused.current) setDisplayValue(isoMonthToBrazilian(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      maxLength={7}
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      className={cn("font-mono", className)}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const masked = maskBrazilianMonth(event.target.value);
        setDisplayValue(masked);
        const isoMonth = brazilianMonthToIso(masked);
        event.currentTarget.setCustomValidity(masked && !isoMonth ? "Use uma competência válida no formato MM-AAAA." : "");
        onValueChange(isoMonth ?? "");
      }}
      onBlur={(event) => {
        focused.current = false;
        const isoMonth = brazilianMonthToIso(displayValue);
        event.currentTarget.setCustomValidity(displayValue && !isoMonth ? "Use uma competência válida no formato MM-AAAA." : "");
        onBlur?.(event);
      }}
    />
  );
}

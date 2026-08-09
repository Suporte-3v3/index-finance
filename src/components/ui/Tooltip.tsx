/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactElement, ReactNode, useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "./cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  children?: ReactElement<{
    "aria-describedby"?: string;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
  }>;
  side?: TooltipSide;
  className?: string;
}

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

// Tooltip acessível por hover e por foco de teclado. Sem children, renderiza um
// ícone de informação como gatilho — usado nos cards de indicador para explicar
// a fórmula de cálculo sem ocupar espaço permanente na tela.
export default function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const trigger = children ?? (
    <button
      type="button"
      aria-label="Mais informações"
      className="inline-flex items-center justify-center text-ink-soft dark:text-ink-soft-dark hover:text-brand-navy-900 dark:hover:text-brand-gold-300 cursor-help"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <span className={cn("relative inline-flex", className)}>
      {React.cloneElement(trigger, {
        "aria-describedby": tooltipId,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(
          "pointer-events-none absolute z-30 w-max max-w-64 rounded-lg bg-brand-navy-950 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg transition-opacity duration-150",
          SIDE_CLASSES[side],
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}

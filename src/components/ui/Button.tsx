/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "text";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Ação principal — vermelho institucional (spec: "vermelho: botão principal, ações importantes").
  primary:
    "bg-brand-red-600 hover:bg-brand-red-500 text-white border border-transparent shadow-sm disabled:bg-red-200 disabled:text-red-50 dark:disabled:bg-red-900/40",
  // Ação de navegação/confirmação neutra em contexto institucional (navy).
  secondary:
    "bg-brand-navy-900 hover:bg-brand-navy-700 text-white border border-transparent shadow-sm disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400",
  outline:
    "bg-surface dark:bg-surface-dark hover:bg-canvas dark:hover:bg-white/5 text-ink dark:text-ink-dark border border-line dark:border-line-dark disabled:opacity-50",
  text: "bg-transparent hover:bg-brand-navy-900/5 dark:hover:bg-white/5 text-brand-navy-900 dark:text-brand-gold-300 border border-transparent disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-dark",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
}

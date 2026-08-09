/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type IconButtonVariant = "default" | "ghost" | "danger" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  default:
    "text-ink-soft dark:text-ink-soft-dark hover:bg-canvas dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark border border-transparent",
  ghost:
    "text-ink-soft dark:text-ink-soft-dark hover:bg-brand-navy-900/5 dark:hover:bg-white/5 border border-transparent",
  danger:
    "text-brand-red-600 hover:bg-brand-red-50 dark:hover:bg-brand-red-600/10 border border-transparent",
  solid:
    "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border border-line dark:border-line-dark hover:bg-canvas dark:hover:bg-white/5 shadow-sm",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5",
};

export default function IconButton({
  icon,
  label,
  variant = "default",
  size = "md",
  className,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-dark",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}

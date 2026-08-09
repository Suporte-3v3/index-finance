/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export function Table({
  children,
  className,
  wrapperClassName,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark",
        wrapperClassName,
      )}
    >
      <table className={cn("w-full text-left border-collapse", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead
      className={cn(
        "bg-canvas/70 dark:bg-white/[0.03] border-b border-line dark:border-line-dark",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tbody className={cn("divide-y divide-line dark:divide-line-dark", className)}>
      {children}
    </tbody>
  );
}

export function Tr({
  children,
  className,
  onClick,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer",
        "hover:bg-canvas/70 dark:hover:bg-white/[0.03]",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function Th({
  children,
  className,
  align = "left",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:text-ink-soft-dark whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-ink dark:text-ink-dark align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

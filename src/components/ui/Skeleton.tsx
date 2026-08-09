/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "./cn";

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe:animate-pulse rounded-md bg-zinc-200/70 dark:bg-white/10",
        className,
      )}
    />
  );
}

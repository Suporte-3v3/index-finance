/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

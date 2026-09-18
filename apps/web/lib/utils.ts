/**
 * Shared utilities for the web app.
 */

import { type ClassValue, clsx } from "clsx";

/**
 * Merge Tailwind CSS class names with conflict resolution.
 * Uses clsx for conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Format a COP (Colombian Peso) value for display.
 * @example formatCOP("1500000") → "$1.500.000"
 */
export function formatCOP(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "N/A";
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "N/A";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a date string for display.
 *
 * Socrata returns floating timestamps ("2024-03-15T00:00:00.000") whose
 * calendar date is the source of truth. We extract the date part and
 * format it in UTC so the displayed day never shifts with server timezone.
 *
 * @example formatDate("2024-03-15T00:00:00.000") → "15 mar 2024"
 */
export function formatDate(value: string | undefined): string {
  if (!value) return "N/A";
  try {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return value;
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return value;
  }
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

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
 * @example formatDate("2024-03-15T00:00:00.000") → "15 mar 2024"
 */
export function formatDate(value: string | undefined): string {
  if (!value) return "N/A";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
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

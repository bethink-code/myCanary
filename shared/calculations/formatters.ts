/**
 * Shared formatting helpers.
 * Pure functions — no framework dependencies. Used by both server and client.
 */

// ─── Date Formatting ────────────────────────────────────────

/** "8 April 2026" */
export function formatDateLong(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

/** "08 Apr 2026" */
export function formatDateShort(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

/** "April 2026" */
export function formatMonthYear(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("default", { month: "long", year: "numeric" });
}

/** "2026-04-08" (ISO date only) */
export function formatDateISO(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/** "8 Apr 2026, 14:30" */
export function formatTimestamp(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── Stock Formatting ───────────────────────────────────────

/** "150 units (12.5 cases)" or "28 units" for horse mixes */
export function formatStock(
  units: number,
  unitsPerCase: number | null,
  category?: string
): string {
  if (category === "HORSE_MIX" || !unitsPerCase) {
    return `${units} units`;
  }
  const cases = (units / unitsPerCase).toFixed(1);
  return `${units} units (${cases} cases)`;
}

// ─── Status Badges ──────────────────────────────────────────

export interface StatusBadgeInfo {
  label: string;
  className: string;
}

const STATUS_MAP: Record<string, StatusBadgeInfo> = {
  REORDER:     { label: "Reorder",     className: "bg-red-100 text-red-700" },
  APPROACHING: { label: "Approaching", className: "bg-amber-100 text-amber-700" },
  OK:          { label: "OK",          className: "bg-green-100 text-green-700" },
  "N/A":       { label: "N/A",         className: "bg-slate-100 text-slate-500" },
  NO_DATA:     { label: "No data",     className: "bg-slate-100 text-slate-500" },
};

/** Get status badge info from a status string. */
export function getStatusBadge(status: string): StatusBadgeInfo {
  return STATUS_MAP[status] ?? STATUS_MAP["N/A"];
}

// ─── Misc ───────────────────────────────────────────────────

/** Days between now and a date string. Positive = future. */
export function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

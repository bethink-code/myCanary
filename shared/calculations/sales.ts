/**
 * Pure sales-aggregation functions for the Sales landing.
 * No DB, no Express, no React.
 */

export interface SalesBuckets {
  unitsSoldThisMonth: number;
  pnpDispatchesThisMonth: number;
}

export interface SalesOrderLike {
  units: number;
  /** ISO date string (yyyy-mm-dd or full ISO) */
  createdAt: string;
}

export interface PnpRunLike {
  /** ISO date string */
  createdAt: string;
}

function isThisMonth(iso: string, today: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

/** Aggregate orders + PnP runs into the Sales landing's status-card numbers. */
export function calcSalesBuckets(
  orders: SalesOrderLike[],
  pnpRuns: PnpRunLike[],
  today: Date = new Date(),
): SalesBuckets {
  let unitsSoldThisMonth = 0;
  for (const o of orders) {
    if (isThisMonth(o.createdAt, today)) unitsSoldThisMonth += o.units;
  }
  let pnpDispatchesThisMonth = 0;
  for (const r of pnpRuns) {
    if (isThisMonth(r.createdAt, today)) pnpDispatchesThisMonth++;
  }
  return { unitsSoldThisMonth, pnpDispatchesThisMonth };
}

export type ChannelStatus = "current" | "due" | "behind" | "no-data";

export interface ChannelStatusInput {
  /** ISO date of last activity (last import / last dispatch / last order) */
  lastActivityAt?: string | null;
  /** Days after which "current" becomes "due" */
  dueAfterDays: number;
  /** Days after which "due" becomes "behind". If absent, never becomes "behind". */
  behindAfterDays?: number;
}

/** Status pill for a sales channel based on freshness of last activity. */
export function calcChannelStatus(input: ChannelStatusInput, today: Date = new Date()): ChannelStatus {
  if (!input.lastActivityAt) return "no-data";
  const last = new Date(input.lastActivityAt);
  const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (input.behindAfterDays !== undefined && daysSince >= input.behindAfterDays) return "behind";
  if (daysSince >= input.dueAfterDays) return "due";
  return "current";
}

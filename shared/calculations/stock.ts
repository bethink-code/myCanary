/**
 * Pure stock calculation functions.
 * No DB, no Express, no React. Usable by both server and client.
 */

export type StockStatus = "REORDER" | "APPROACHING" | "OK" | "N/A" | "NO_DATA";
export type OverallStatus = "ACTION_NEEDED" | "HEADS_UP" | "ALL_GOOD";

/** Calculate stock status from current level and reorder point. */
export function calcStockStatus(current: number, reorderPoint: number | null): StockStatus {
  if (reorderPoint === null || reorderPoint === 0) return "N/A";
  if (current <= reorderPoint) return "REORDER";
  if (current <= reorderPoint * 1.25) return "APPROACHING";
  return "OK";
}

/** Units consumed per day from total out units over a window. */
export function calcDepletionRate(totalOutUnits: number, windowDays: number): number {
  if (windowDays <= 0) return 0;
  return totalOutUnits / windowDays;
}

/** Days until stock reaches zero at current depletion rate. */
export function calcDaysRemaining(currentStock: number, depletionRate: number): number | null {
  if (depletionRate <= 0) return null;
  return Math.round((currentStock / depletionRate) * 10) / 10;
}

/** Date when stock will hit reorder point at current depletion rate. */
export function calcProjectedReorderDate(
  currentStock: number,
  reorderPoint: number | null,
  depletionRate: number,
  today: Date = new Date()
): string | null {
  if (depletionRate <= 0 || reorderPoint === null || reorderPoint === undefined) return null;
  const daysUntilReorder = (currentStock - reorderPoint) / depletionRate;
  const reorderDate = new Date(today);
  if (daysUntilReorder > 0) {
    reorderDate.setDate(reorderDate.getDate() + Math.ceil(daysUntilReorder));
  }
  return reorderDate.toISOString().split("T")[0];
}

/** Overall status from an array of individual statuses. */
export function calcOverallStatus(statuses: StockStatus[]): OverallStatus {
  if (statuses.some((s) => s === "REORDER")) return "ACTION_NEEDED";
  if (statuses.some((s) => s === "APPROACHING")) return "HEADS_UP";
  return "ALL_GOOD";
}

/** Reorder point formula: (annual_sales / 365) * buffer_days */
export function calcReorderPoint(annualSalesUnits: number, bufferDays: number = 75): number {
  return Math.round((annualSalesUnits / 365) * bufferDays);
}

/** Recommended order quantity: Target = RP × 2, Gap = Target − Current */
export function calcRecommendedOrderQty(currentStock: number, reorderPoint: number): number {
  const target = reorderPoint * 2;
  return Math.max(0, target - currentStock);
}

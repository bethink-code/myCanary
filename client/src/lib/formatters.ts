/**
 * Re-export shared formatters and calculations for client-side use.
 * Source of truth: shared/calculations/
 */
export {
  formatDateLong,
  formatDateShort,
  formatMonthYear,
  formatDateISO,
  formatTimestamp,
  formatStock,
  getStatusBadge,
  daysFromNow,
} from "@shared/calculations/formatters";

export type { StatusBadgeInfo } from "@shared/calculations/formatters";

export {
  calcStockStatus,
  calcDepletionRate,
  calcDaysRemaining,
  calcProjectedReorderDate,
  calcOverallStatus,
  calcReorderPoint,
  calcRecommendedOrderQty,
} from "@shared/calculations/stock";

export type { StockStatus, OverallStatus } from "@shared/calculations/stock";

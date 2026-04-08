import { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate all stock-related caches.
 * Call after any mutation that changes stock levels:
 * opening balance, delivery, transfer, Xero import, PnP dispatch, adjustments.
 */
export function invalidateStockData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["stock-summary"] });
  qc.invalidateQueries({ queryKey: ["snapshot-overview"] });
  qc.invalidateQueries({ queryKey: ["snapshot-rhythm"] });
  qc.invalidateQueries({ queryKey: ["products"] });
  qc.invalidateQueries({ queryKey: ["ledger-date"] });
  qc.invalidateQueries({ queryKey: ["purchase-orders"] });
}

/**
 * Invalidate order-related caches.
 * Call after creating, advancing, or modifying orders.
 */
export function invalidateOrderData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["orders"] });
  qc.invalidateQueries({ queryKey: ["snapshot-overview"] });
}

import { Router } from "express";
import { db } from "./db";
import { stockTransactions, pnpOrders, orders } from "../shared/schema";
import { eq, and, sql, desc, gte, ne } from "drizzle-orm";
import { isAuthenticated } from "./routes";
import { getClientId } from "./clientContext";

/**
 * GET /api/sales/summary
 * Aggregated counts and channel statuses for the Sales landing page.
 */
export function registerSalesSummaryRoutes(router: Router) {
  router.get("/api/sales/summary", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfMonthIso = startOfMonth.toISOString().slice(0, 10);

      // ─── Xero direct sales (via stock_transactions SALES_OUT) ──────────
      const [xeroAgg] = await db
        .select({
          unitsThisMonth: sql<number>`COALESCE(SUM(ABS(${stockTransactions.quantity})), 0)`.mapWith(Number),
        })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.clientId, clientId),
            eq(stockTransactions.transactionType, "SALES_OUT"),
            gte(stockTransactions.transactionDate, startOfMonthIso),
          ),
        );

      const [lastSale] = await db
        .select({ lastDate: stockTransactions.transactionDate })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.clientId, clientId),
            eq(stockTransactions.transactionType, "SALES_OUT"),
          ),
        )
        .orderBy(desc(stockTransactions.transactionDate))
        .limit(1);

      // ─── PnP dispatches this month ─────────────────────────────────────
      const [pnpAgg] = await db
        .select({
          dispatchesThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${pnpOrders.status} = 'DISPATCHED' AND ${pnpOrders.createdAt} >= ${startOfMonth})`.mapWith(Number),
        })
        .from(pnpOrders)
        .where(eq(pnpOrders.clientId, clientId));

      const [lastDispatch] = await db
        .select({ dispatchedAt: pnpOrders.dispatchInstructionSentAt })
        .from(pnpOrders)
        .where(
          and(
            eq(pnpOrders.clientId, clientId),
            eq(pnpOrders.status, "DISPATCHED"),
          ),
        )
        .orderBy(desc(pnpOrders.dispatchInstructionSentAt))
        .limit(1);

      // ─── Customer orders pending (anything not yet DISPATCHED) ─────────
      const [customerAgg] = await db
        .select({
          pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} != 'DISPATCHED')`.mapWith(Number),
        })
        .from(orders)
        .where(eq(orders.clientId, clientId));

      const [lastOrder] = await db
        .select({ orderDate: orders.orderDate })
        .from(orders)
        .where(eq(orders.clientId, clientId))
        .orderBy(desc(orders.orderDate))
        .limit(1);

      res.json({
        unitsSoldThisMonth: xeroAgg?.unitsThisMonth ?? 0,
        salesImportedTo: lastSale?.lastDate ?? null,
        pnpDispatchesThisMonth: pnpAgg?.dispatchesThisMonth ?? 0,
        channelStatuses: {
          xero: {
            lastImportAt: lastSale?.lastDate ?? null,
            unitsThisMonth: xeroAgg?.unitsThisMonth ?? 0,
          },
          pnp: {
            lastDispatchAt: lastDispatch?.dispatchedAt ?? null,
            dispatchesThisMonth: pnpAgg?.dispatchesThisMonth ?? 0,
          },
          customerOrders: {
            pendingCount: customerAgg?.pendingCount ?? 0,
            lastOrderDate: lastOrder?.orderDate ?? null,
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load sales summary", error: err.message });
    }
  });
}

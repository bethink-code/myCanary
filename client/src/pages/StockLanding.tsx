import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/queryClient";
import { calcStockHealthBuckets } from "../../../shared/calculations/stock";
import StockShell from "./stock/StockShell";
import ProductsTable, { type StockItem } from "./stock/ProductsTable";
import type { StatusCardData } from "./stock/StatusCards";

export default function StockLanding() {
  const { data: stockItems = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ["stock-summary"],
    queryFn: () => apiRequest("/api/stock/summary"),
  });

  // Drive status cards off the same data the table uses; recalc-on-edit per architecture.md.
  const buckets = calcStockHealthBuckets(
    stockItems.map((item) => ({
      currentStock:
        item.primaryStockLocation === "88" ? item.eightEightStock : item.thhStock,
      reorderPoint: item.reorderPoint,
    })),
  );

  const statusCards: StatusCardData[] = [
    {
      label: "Reorder now",
      value: buckets.reorder,
      caption: "products at or below reorder point",
      severity: buckets.reorder > 0 ? "critical" : "neutral",
    },
    {
      label: "Approaching",
      value: buckets.approaching,
      caption: "products within 30 days of reorder",
      severity: buckets.approaching > 0 ? "warning" : "neutral",
    },
    {
      label: "Healthy",
      value: buckets.healthy,
      caption: "products with comfortable stock",
      severity: "ok",
    },
  ];

  return (
    <StockShell
      title="Stock"
      subtitle="What you have, where it is, and how it's moving."
      statusCards={statusCards}
    >
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Quick actions</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            to="/stock/transfer"
            className="block p-4 bg-white rounded-xl border border-border hover:border-slate-300 transition-colors"
          >
            <div className="font-medium text-slate-900">Transfer stock</div>
            <div className="text-sm text-slate-500 mt-0.5">Move units THH ↔ 8/8</div>
          </Link>
          <Link
            to="/stock/adjustment"
            className="block p-4 bg-white rounded-xl border border-border hover:border-slate-300 transition-colors"
          >
            <div className="font-medium text-slate-900">Record adjustment</div>
            <div className="text-sm text-slate-500 mt-0.5">Correct a stock discrepancy</div>
          </Link>
        </div>
      </div>

      <ProductsTable items={stockItems} isLoading={isLoading} />
    </StockShell>
  );
}

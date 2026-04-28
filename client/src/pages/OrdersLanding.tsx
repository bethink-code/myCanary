import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/queryClient";
import LoadingOverlay from "../components/LoadingOverlay";
import { calcPoBuckets, type PoSummary } from "../../../shared/calculations/po";
import StatusCards, { type StatusCardData } from "./stock/StatusCards";
import InTransitPipeline from "./orders/InTransitPipeline";
import PoHistoryTable from "./orders/PoHistoryTable";

interface POSummary {
  id: number;
  manufacturerName: string;
  status: string;
  createdDate: string;
  expectedDeliveryDate: string | null;
  deliveredAt: string | null;
  lineCount: number;
  totalUnits: number;
  skuSummary: string | null;
}

export default function OrdersLanding() {
  const { data: orders = [], isLoading } = useQuery<POSummary[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => apiRequest("/api/purchase-orders"),
  });

  const buckets = calcPoBuckets(orders as PoSummary[]);

  const statusCards: StatusCardData[] = [
    {
      label: "Open POs",
      value: buckets.open,
      caption: "orders placed, awaiting delivery",
      severity: buckets.open > 0 ? "warning" : "neutral",
    },
    {
      label: "Due this week",
      value: buckets.dueThisWeek,
      caption: "expected delivery within 7 days",
      severity: buckets.dueThisWeek > 0 ? "warning" : "neutral",
    },
    {
      label: "Delivered this month",
      value: buckets.deliveredThisMonth,
      caption: "deliveries received and recorded",
      severity: "ok",
    },
  ];

  if (isLoading) return <LoadingOverlay message="Loading orders..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Purchase orders placed with manufacturers — from reorder to delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/orders/delivery"
            className="px-4 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Record delivery
          </Link>
          <Link
            to="/orders/reorder"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            New reorder
          </Link>
        </div>
      </div>

      <StatusCards cards={statusCards} />

      <InTransitPipeline orders={orders as PoSummary[]} />

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">All purchase orders</div>
        <PoHistoryTable orders={orders} />
      </div>
    </div>
  );
}

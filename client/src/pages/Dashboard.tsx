import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { formatDateShort } from "../lib/formatters";
import LoadingOverlay from "../components/LoadingOverlay";
import RhythmPrompts, { type RhythmData } from "../components/RhythmPrompts";
import StatusCards, { type StatusCardData } from "./stock/StatusCards";
import { calcStockHealthBuckets } from "../../../shared/calculations/stock";
import { calcPoBuckets, type PoSummary } from "../../../shared/calculations/po";

interface SnapshotProduct {
  currentStock: number;
  reorderPoint: number | null;
}

interface DataFreshness {
  openingBalanceDate: string | null;
  lastSalesImportTo: string | null;
  lastTransactionAt: string | null;
}

interface SnapshotOverview {
  items: SnapshotProduct[];
  dataFreshness: DataFreshness;
}

interface SalesSummary {
  channelStatuses: {
    xero: { lastImportAt: string | null };
    pnp: { lastDispatchAt: string | null; dispatchesThisMonth: number };
    customerOrders: { pendingCount: number };
  };
}

function firstName(email?: string | null, given?: string | null): string {
  if (given) return given;
  if (!email) return "there";
  return email.split("@")[0];
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: overview, isLoading: overviewLoading } = useQuery<SnapshotOverview>({
    queryKey: ["snapshot-overview"],
    queryFn: () => apiRequest("/api/snapshot/overview"),
  });

  const { data: orders = [] } = useQuery<PoSummary[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => apiRequest("/api/purchase-orders"),
  });

  const { data: rhythm } = useQuery<RhythmData>({
    queryKey: ["snapshot-rhythm"],
    queryFn: () => apiRequest("/api/snapshot/rhythm"),
  });

  const { data: sales } = useQuery<SalesSummary>({
    queryKey: ["sales-summary"],
    queryFn: () => apiRequest("/api/sales/summary"),
  });

  if (overviewLoading) return <LoadingOverlay message="Loading dashboard..." />;

  const stockBuckets = calcStockHealthBuckets(overview?.items ?? []);
  const poBuckets = calcPoBuckets(orders);

  // Sales actions = number of channels needing attention
  let salesActions = 0;
  if (sales?.channelStatuses) {
    if (sales.channelStatuses.customerOrders.pendingCount > 0) salesActions++;
    // PnP needs action if no dispatch in last 7 days (mirrors RhythmPrompts logic)
    const last = sales.channelStatuses.pnp.lastDispatchAt;
    const pnpDue = !last || (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    if (pnpDue) salesActions++;
    // Xero needs action if last import is before previous month end
    const xeroLast = sales.channelStatuses.xero.lastImportAt;
    const now = new Date();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    if (!xeroLast || new Date(xeroLast) < prevMonthEnd) salesActions++;
  }

  const cards: StatusCardData[] = [
    {
      label: "Stock",
      value: stockBuckets.reorder,
      caption: "products at or below reorder point",
      severity: stockBuckets.reorder > 0 ? "critical" : "ok",
      to: "/stock",
    },
    {
      label: "Orders",
      value: poBuckets.open,
      caption: "purchase orders in transit",
      severity: poBuckets.dueThisWeek > 0 ? "warning" : poBuckets.open > 0 ? "neutral" : "ok",
      to: "/orders",
    },
    {
      label: "Sales",
      value: salesActions,
      caption: "actions needed",
      severity: salesActions > 0 ? "warning" : "ok",
      to: "/sales",
    },
  ];

  const freshness = overview?.dataFreshness;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{greeting}, {firstName(user?.email, user?.firstName)}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          {stockBuckets.reorder > 0
            ? `Action needed — ${stockBuckets.reorder} ${stockBuckets.reorder === 1 ? "product requires" : "products require"} a decision today.`
            : "All clear — nothing requires a decision today."}
        </h1>
      </div>

      <StatusCards cards={cards} />

      <RhythmPrompts rhythm={rhythm} scope="all" />

      {freshness && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 pt-2 border-t border-border">
          {freshness.openingBalanceDate && (
            <span>
              Opening balance: <strong className="text-slate-600">{formatDateShort(freshness.openingBalanceDate)}</strong>
            </span>
          )}
          {freshness.lastSalesImportTo && (
            <span>
              Sales imported to: <strong className="text-slate-600">{formatDateShort(freshness.lastSalesImportTo)}</strong>
            </span>
          )}
          {freshness.lastTransactionAt && (
            <span>
              Last updated: <strong className="text-slate-600">{formatDateShort(freshness.lastTransactionAt)}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

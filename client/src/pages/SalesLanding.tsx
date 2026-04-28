import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { formatDateShort } from "../lib/formatters";
import LoadingOverlay from "../components/LoadingOverlay";
import RhythmPrompts, { type RhythmData } from "../components/RhythmPrompts";
import StatusCards, { type StatusCardData } from "./stock/StatusCards";
import ChannelCard, { type ChannelPill } from "./sales/ChannelCard";
import { calcChannelStatus } from "../../../shared/calculations/sales";

interface SalesSummary {
  unitsSoldThisMonth: number;
  salesImportedTo: string | null;
  pnpDispatchesThisMonth: number;
  channelStatuses: {
    xero: { lastImportAt: string | null; unitsThisMonth: number };
    pnp: { lastDispatchAt: string | null; dispatchesThisMonth: number };
    customerOrders: { pendingCount: number; lastOrderDate: string | null };
  };
}

function pillFromStatus(s: ReturnType<typeof calcChannelStatus>): ChannelPill {
  if (s === "no-data") return "none";
  if (s === "current") return "current";
  if (s === "due") return "due";
  return "behind";
}

export default function SalesLanding() {
  const { data: summary, isLoading } = useQuery<SalesSummary>({
    queryKey: ["sales-summary"],
    queryFn: () => apiRequest("/api/sales/summary"),
  });

  const { data: rhythm } = useQuery<RhythmData>({
    queryKey: ["snapshot-rhythm"],
    queryFn: () => apiRequest("/api/snapshot/rhythm"),
  });

  if (isLoading) return <LoadingOverlay message="Loading sales..." />;

  const xero = summary?.channelStatuses.xero;
  const pnp = summary?.channelStatuses.pnp;
  const customer = summary?.channelStatuses.customerOrders;

  const xeroStatus = calcChannelStatus({ lastActivityAt: xero?.lastImportAt ?? null, dueAfterDays: 14, behindAfterDays: 31 });
  const pnpStatus = calcChannelStatus({ lastActivityAt: pnp?.lastDispatchAt ?? null, dueAfterDays: 7, behindAfterDays: 14 });

  const cards: StatusCardData[] = [
    {
      label: "Units sold this month",
      value: summary?.unitsSoldThisMonth ?? 0,
      caption: "across all channels",
      severity: "neutral",
    },
    {
      label: "Sales imported to",
      value: summary?.salesImportedTo ? formatDateShort(summary.salesImportedTo) : "—",
      caption: xeroStatus === "current" ? "up to date" : xeroStatus === "no-data" ? "no imports yet" : "may not yet imported",
      severity: xeroStatus === "behind" || xeroStatus === "no-data" ? "warning" : "neutral",
    },
    {
      label: "PnP dispatches this month",
      value: summary?.pnpDispatchesThisMonth ?? 0,
      caption: pnp?.lastDispatchAt ? `last: ${formatDateShort(pnp.lastDispatchAt)}` : "no dispatches recorded yet",
      severity: pnpStatus === "due" || pnpStatus === "behind" ? "warning" : "neutral",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
        <p className="text-sm text-slate-500 mt-1">Stock leaving the business — by channel.</p>
      </div>

      <RhythmPrompts rhythm={rhythm} scope="sales" />

      <StatusCards cards={cards} />

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Channels</div>
        <div className="grid gap-3 md:grid-cols-3">
          <ChannelCard
            title="Xero — direct sales"
            pill={pillFromStatus(xeroStatus)}
            caption={
              xero?.lastImportAt
                ? `Last import: ${formatDateShort(xero.lastImportAt)} · ${xero.unitsThisMonth} units this month`
                : "No imports yet"
            }
            to="/sales/xero/import"
            ctaLabel="Import sales"
          />
          <ChannelCard
            title="Pick n Pay"
            pill={pillFromStatus(pnpStatus)}
            pillLabel={pnpStatus === "due" || pnpStatus === "behind" ? "Dispatch due" : pnpStatus === "current" ? "Up to date" : "No data"}
            caption={
              pnp?.lastDispatchAt
                ? `Last dispatch: ${formatDateShort(pnp.lastDispatchAt)}`
                : "Last dispatch: not yet recorded"
            }
            to="/sales/pnp"
            ctaLabel="Start weekly process"
          />
          <ChannelCard
            title="Customer orders"
            pill={(customer?.pendingCount ?? 0) > 0 ? "due" : "current"}
            pillLabel={(customer?.pendingCount ?? 0) > 0 ? `${customer?.pendingCount} pending` : "No open orders"}
            caption={customer?.lastOrderDate ? `Last order: ${formatDateShort(customer.lastOrderDate)}` : "Last order: —"}
            to="/sales/customer-orders"
            ctaLabel="View / new order"
          />
        </div>
      </div>
    </div>
  );
}

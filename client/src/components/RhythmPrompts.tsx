import { Link } from "react-router-dom";
import { formatDateShort } from "../lib/formatters";

export interface RhythmData {
  lastPnpUpload: string | null;
  lastXeroImport: string | null;
  pendingDeliveries: {
    manufacturer: string;
    expectedDeliveryDate: string | null;
    status: string;
    daysUntilDelivery: number | null;
  }[];
}

export type RhythmScope = "all" | "sales" | "orders";

/**
 * Working-rhythm nudges. Surfaced on Dashboard (scope="all") and on the
 * relevant operational landing pages (Sales, Orders).
 */
export default function RhythmPrompts({
  rhythm,
  scope = "all",
}: {
  rhythm: RhythmData | undefined;
  scope?: RhythmScope;
}) {
  if (!rhythm) return null;

  const showPnpAndXero = scope === "all" || scope === "sales";
  const showDeliveries = scope === "all" || scope === "orders";

  const prompts: JSX.Element[] = [];

  if (showPnpAndXero) {
    // PnP check: no upload in last 7 days, or never uploaded
    const pnpDue = (() => {
      if (!rhythm.lastPnpUpload) return true;
      const daysSince = Math.floor(
        (Date.now() - new Date(rhythm.lastPnpUpload).getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysSince >= 7;
    })();

    if (pnpDue) {
      prompts.push(
        <div key="pnp" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-warning font-medium">PnP weekly process — ready to start?</p>
          <Link
            to="/sales/pnp"
            className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Go to PnP Weekly
          </Link>
        </div>,
      );
    }

    // Xero check
    const now = new Date();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    if (rhythm.lastXeroImport) {
      const lastImport = new Date(rhythm.lastXeroImport);
      if (lastImport < prevMonthEnd) {
        prompts.push(
          <div key="xero" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-warning font-medium">
              Sales imported to {formatDateShort(rhythm.lastXeroImport)}. Data up to {formatDateShort(prevMonthEnd)} not yet imported.
            </p>
            <Link
              to="/sales/xero/import"
              className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Import from Xero
            </Link>
          </div>,
        );
      }
    } else {
      prompts.push(
        <div key="xero" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-warning font-medium">
            No sales data imported yet. Import from Xero to see accurate stock levels.
          </p>
          <Link
            to="/sales/xero/import"
            className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Import from Xero
          </Link>
        </div>,
      );
    }
  }

  if (showDeliveries) {
    const soon = rhythm.pendingDeliveries.filter(
      (d) => d.daysUntilDelivery != null && d.daysUntilDelivery >= 0 && d.daysUntilDelivery <= 5,
    );
    soon.forEach((d, i) => {
      prompts.push(
        <div key={`delivery-${i}`} className="rounded-xl border border-blue-200 bg-info-bg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-info font-medium">
            {d.manufacturer} delivery expected by {formatDateShort(d.expectedDeliveryDate)} — not yet recorded.
          </p>
          <Link
            to="/orders/delivery"
            className="shrink-0 px-4 py-1.5 rounded-lg bg-info text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Record delivery
          </Link>
        </div>,
      );
    });
  }

  if (prompts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Today</h2>
      {prompts}
    </div>
  );
}

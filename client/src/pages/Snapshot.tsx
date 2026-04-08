import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link } from "react-router-dom";
import LoadingOverlay from "../components/LoadingOverlay";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ---------- types ---------- */

interface SnapshotProduct {
  skuCode: string;
  productName: string;
  currentStock: number;
  reorderPoint: number | null;
  depletionRate: number;
  daysRemaining: number | null;
  projectedReorderDate: string | null;
  status: "OK" | "APPROACHING" | "REORDER" | "NO_DATA";
  manufacturerName: string | null;
  hasPendingDelivery: boolean;
}

interface SnapshotOverview {
  products: SnapshotProduct[];
  summary: {
    total: number;
    ok: number;
    approaching: number;
    reorder: number;
    noData: number;
  };
}

interface RhythmData {
  lastPnpUpload: string | null;
  lastXeroImport: string | null;
  pendingDeliveries: {
    manufacturerName: string;
    expectedDate: string;
    poId: number;
  }[];
}

/* ---------- constants ---------- */

type TimeWindow = 30 | 60 | 90;
type Lens = "data" | "visual";
type RiskFilter = "at-risk" | "time-to-reorder" | "by-supplier" | "in-transit" | "velocity";

const STATUS_ORDER: Record<string, number> = {
  REORDER: 0,
  APPROACHING: 1,
  OK: 2,
  NO_DATA: 3,
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  REORDER: { label: "Reorder", className: "bg-red-100 text-red-700" },
  APPROACHING: { label: "Approaching", className: "bg-amber-100 text-amber-700" },
  OK: { label: "OK", className: "bg-green-100 text-green-700" },
  NO_DATA: { label: "No data", className: "bg-slate-100 text-slate-500" },
};

/* ---------- helpers ---------- */

function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ---------- sub-components ---------- */

function StatusLine({ summary }: { summary: SnapshotOverview["summary"] }) {
  if (summary.reorder > 0) {
    return (
      <div className="rounded-xl px-5 py-3 bg-stock-out-bg border border-red-200 text-stock-out text-sm font-medium">
        {summary.reorder} product{summary.reorder !== 1 ? "s" : ""} at or below reorder point. Decisions needed today.
      </div>
    );
  }
  if (summary.approaching > 0) {
    return (
      <div className="rounded-xl px-5 py-3 bg-warning-bg border border-amber-200 text-warning text-sm font-medium">
        {summary.approaching} product{summary.approaching !== 1 ? "s" : ""} approaching reorder point.
      </div>
    );
  }
  return (
    <div className="rounded-xl px-5 py-3 bg-stock-in-bg border border-green-200 text-stock-in text-sm font-medium">
      All stock levels healthy. No products require attention.
    </div>
  );
}

function TimeWindowSelector({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (w: TimeWindow) => void;
}) {
  const options: TimeWindow[] = [30, 60, 90];
  return (
    <div className="flex gap-2">
      {options.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === w
              ? "bg-primary text-primary-foreground"
              : "bg-white border border-border text-slate-600 hover:bg-slate-50"
          }`}
        >
          {w} days
        </button>
      ))}
    </div>
  );
}

function RiskFilters({
  active,
  onToggle,
  suppliers,
  selectedSupplier,
  onSupplierChange,
}: {
  active: Set<RiskFilter>;
  onToggle: (f: RiskFilter) => void;
  suppliers: string[];
  selectedSupplier: string;
  onSupplierChange: (s: string) => void;
}) {
  const filters: { key: RiskFilter; label: string }[] = [
    { key: "at-risk", label: "At Risk" },
    { key: "time-to-reorder", label: "Time to Reorder" },
    { key: "by-supplier", label: "By Supplier" },
    { key: "in-transit", label: "In Transit" },
    { key: "velocity", label: "Velocity" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onToggle(f.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            active.has(f.key)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-white text-slate-600 border-border hover:bg-slate-50"
          }`}
        >
          {f.label}
        </button>
      ))}
      {active.has("by-supplier") && (
        <select
          value={selectedSupplier}
          onChange={(e) => onSupplierChange(e.target.value)}
          className="ml-1 px-3 py-1.5 rounded-lg text-xs border border-border bg-white text-slate-700"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function LensToggle({ value, onChange }: { value: Lens; onChange: (l: Lens) => void }) {
  return (
    <div className="flex border border-border rounded-lg overflow-hidden w-fit">
      <button
        onClick={() => onChange("data")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "data" ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Data
      </button>
      <button
        onClick={() => onChange("visual")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "visual" ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Visual
      </button>
    </div>
  );
}

type SortKey = "product" | "currentStock" | "reorderPoint" | "daysRemaining" | "projectedReorderDate" | "status";

function DataTable({
  products,
  sortKey,
  sortAsc,
  onSort,
}: {
  products: SnapshotProduct[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "product", label: "Product" },
    { key: "currentStock", label: "Current Stock", className: "text-right" },
    { key: "reorderPoint", label: "Reorder Point", className: "text-right" },
    { key: "daysRemaining", label: "Days Remaining", className: "text-right" },
    { key: "projectedReorderDate", label: "Projected Reorder" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`py-3 px-3 text-left font-medium text-slate-500 cursor-pointer hover:text-slate-900 select-none ${col.className ?? ""}`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-400">
                No products match the current filters.
              </td>
            </tr>
          )}
          {products.map((p) => {
            const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.NO_DATA;
            return (
              <tr key={p.skuCode} className="border-b border-border/50 hover:bg-slate-50/50">
                <td className="py-3 px-3">
                  <Link to={`/stock/product/${p.skuCode}`} className="text-slate-900 hover:text-primary font-medium">
                    {p.productName}
                  </Link>
                  <div className="text-xs text-slate-400 mt-0.5">{p.skuCode}</div>
                </td>
                <td className="py-3 px-3 text-right tabular-nums">{p.currentStock}</td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {p.reorderPoint != null ? p.reorderPoint : (
                    <span className="text-slate-400">Not set</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {p.daysRemaining != null ? p.daysRemaining : (
                    <span className="text-slate-400">{"\u2014"}</span>
                  )}
                </td>
                <td className="py-3 px-3">{formatDate(p.projectedReorderDate)}</td>
                <td className="py-3 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const GRAPH_COLORS = [
  "#dc2626", "#d97706", "#2563eb", "#16a34a", "#9333ea",
  "#0891b2", "#c026d3", "#ea580c", "#4f46e5", "#059669",
];

function VisualLens({
  products,
  window,
}: {
  products: SnapshotProduct[];
  window: TimeWindow;
}) {
  // Only show products that have depletion data and a reorder point
  const graphProducts = products.filter(
    (p) => p.depletionRate > 0 && p.reorderPoint != null
  );

  if (graphProducts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <p className="text-slate-400 text-sm">
          No products with depletion data to graph. Import sales data to see projections.
        </p>
      </div>
    );
  }

  // Build time-series data: one point per day from today to today + window
  const today = new Date();
  const dataPoints: Record<string, any>[] = [];

  for (let d = 0; d <= window; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    const point: Record<string, any> = { date: dateStr, day: d };

    for (const p of graphProducts) {
      const projected = p.currentStock - p.depletionRate * d;
      point[p.skuCode] = Math.max(0, Math.round(projected));
    }

    dataPoints.push(point);
  }

  // Find the lowest reorder point for the reference line
  const minReorderPoint = Math.min(
    ...graphProducts.map((p) => p.reorderPoint!).filter(Boolean)
  );

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="text-xs text-slate-500 mb-4">
        Projected stock levels over {window} days based on current depletion rates.
        Dashed lines show reorder thresholds.
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={dataPoints} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
            }}
            interval={Math.floor(window / 6)}
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip
            labelFormatter={(v) =>
              new Date(v).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            }
            formatter={(value: number, name: string) => {
              const product = graphProducts.find((p) => p.skuCode === name);
              return [
                `${value} units`,
                product ? product.productName : name,
              ];
            }}
          />
          <Legend
            formatter={(value) => {
              const product = graphProducts.find((p) => p.skuCode === value);
              return product ? product.productName : value;
            }}
            wrapperStyle={{ fontSize: 12 }}
          />
          {graphProducts.map((p, i) => (
            <ReferenceLine
              key={`rp-${p.skuCode}`}
              y={p.reorderPoint!}
              stroke={GRAPH_COLORS[i % GRAPH_COLORS.length]}
              strokeDasharray="6 4"
              strokeOpacity={0.4}
            />
          ))}
          {graphProducts.map((p, i) => (
            <Line
              key={p.skuCode}
              type="monotone"
              dataKey={p.skuCode}
              stroke={GRAPH_COLORS[i % GRAPH_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RhythmPrompts({ rhythm }: { rhythm: RhythmData | undefined }) {
  if (!rhythm) return null;

  const prompts: JSX.Element[] = [];

  // PnP check: no upload in last 7 days
  if (rhythm.lastPnpUpload) {
    const daysSince = Math.floor(
      (Date.now() - new Date(rhythm.lastPnpUpload).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= 7) {
      prompts.push(
        <div key="pnp" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-warning font-medium">
            PnP weekly process — ready to start?
          </p>
          <Link
            to="/pnp"
            className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Go to PnP Weekly
          </Link>
        </div>
      );
    }
  } else {
    // Never uploaded
    prompts.push(
      <div key="pnp" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-warning font-medium">
          PnP weekly process — ready to start?
        </p>
        <Link
          to="/pnp"
          className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Go to PnP Weekly
        </Link>
      </div>
    );
  }

  // Xero check: no import for current month
  if (rhythm.lastXeroImport) {
    const lastImport = new Date(rhythm.lastXeroImport);
    const now = new Date();
    if (
      lastImport.getFullYear() < now.getFullYear() ||
      lastImport.getMonth() < now.getMonth()
    ) {
      prompts.push(
        <div key="xero" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-warning font-medium">
            Last month's sales haven't been imported yet.
          </p>
          <Link
            to="/xero/import"
            className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Import from Xero
          </Link>
        </div>
      );
    }
  } else {
    prompts.push(
      <div key="xero" className="rounded-xl border border-amber-200 bg-warning-bg p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-warning font-medium">
          Last month's sales haven't been imported yet.
        </p>
        <Link
          to="/xero/import"
          className="shrink-0 px-4 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Import from Xero
        </Link>
      </div>
    );
  }

  // Pending deliveries within 5 days
  const soon = rhythm.pendingDeliveries.filter((d) => {
    const days = daysFromNow(d.expectedDate);
    return days != null && days >= 0 && days <= 5;
  });
  soon.forEach((d) => {
    prompts.push(
      <div key={`delivery-${d.poId}`} className="rounded-xl border border-blue-200 bg-info-bg p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-info font-medium">
          {d.manufacturerName} delivery expected by {formatDate(d.expectedDate)} — not yet recorded.
        </p>
        <Link
          to="/stock/delivery"
          className="shrink-0 px-4 py-1.5 rounded-lg bg-info text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Record Delivery
        </Link>
      </div>
    );
  });

  if (prompts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Working Rhythm</h2>
      {prompts}
    </div>
  );
}

/* ---------- main component ---------- */

export default function Snapshot() {
  const [window, setWindow] = useState<TimeWindow>(30);
  const [lens, setLens] = useState<Lens>("data");
  const [activeFilters, setActiveFilters] = useState<Set<RiskFilter>>(new Set());
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);

  const {
    data: overview,
    isLoading: overviewLoading,
  } = useQuery<SnapshotOverview>({
    queryKey: ["snapshot-overview", window],
    queryFn: () => apiRequest(`/api/snapshot/overview?window=${window}`),
  });

  const {
    data: rhythm,
    isLoading: rhythmLoading,
  } = useQuery<RhythmData>({
    queryKey: ["snapshot-rhythm"],
    queryFn: () => apiRequest("/api/snapshot/rhythm"),
  });

  const isLoading = overviewLoading || rhythmLoading;

  // Derive supplier list
  const suppliers = useMemo(() => {
    if (!overview) return [];
    const set = new Set<string>();
    overview.products.forEach((p) => {
      if (p.manufacturerName) set.add(p.manufacturerName);
    });
    return Array.from(set).sort();
  }, [overview]);

  // Filter products
  const filtered = useMemo(() => {
    if (!overview) return [];
    let list = overview.products;

    const filters = activeFilters;

    if (filters.has("at-risk")) {
      list = list.filter((p) => {
        if (!p.projectedReorderDate || p.hasPendingDelivery) return false;
        const days = daysFromNow(p.projectedReorderDate);
        return days != null && days >= 0 && days <= window;
      });
    }

    if (filters.has("time-to-reorder")) {
      list = list.filter((p) => {
        if (!p.projectedReorderDate) return false;
        const days = daysFromNow(p.projectedReorderDate);
        return days != null && days >= 0 && days <= window;
      });
    }

    if (filters.has("by-supplier") && selectedSupplier) {
      list = list.filter((p) => p.manufacturerName === selectedSupplier);
    }

    if (filters.has("in-transit")) {
      list = list.filter((p) => p.hasPendingDelivery);
    }

    // velocity is placeholder — no filtering yet

    return list;
  }, [overview, activeFilters, selectedSupplier, window]);

  // Sort products
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "product":
          cmp = a.productName.localeCompare(b.productName);
          break;
        case "currentStock":
          cmp = a.currentStock - b.currentStock;
          break;
        case "reorderPoint":
          cmp = (a.reorderPoint ?? -1) - (b.reorderPoint ?? -1);
          break;
        case "daysRemaining":
          cmp = (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
          break;
        case "projectedReorderDate": {
          const da = a.projectedReorderDate ? new Date(a.projectedReorderDate).getTime() : Infinity;
          const db = b.projectedReorderDate ? new Date(b.projectedReorderDate).getTime() : Infinity;
          cmp = da - db;
          break;
        }
        case "status":
        default:
          cmp = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
          if (cmp === 0) {
            cmp = (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
          }
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const handleToggleFilter = (f: RiskFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) {
        next.delete(f);
        if (f === "by-supplier") setSelectedSupplier("");
      } else {
        next.add(f);
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (isLoading) {
    return <LoadingOverlay message="Loading snapshot..." />;
  }

  const summary = overview?.summary ?? { total: 0, ok: 0, approaching: 0, reorder: 0, noData: 0 };

  return (
    <div className="space-y-6">
      {/* Status Line */}
      <StatusLine summary={summary} />

      {/* Time Window + Lens */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <TimeWindowSelector value={window} onChange={setWindow} />
        <LensToggle value={lens} onChange={setLens} />
      </div>

      {/* Risk Filters */}
      <RiskFilters
        active={activeFilters}
        onToggle={handleToggleFilter}
        suppliers={suppliers}
        selectedSupplier={selectedSupplier}
        onSupplierChange={setSelectedSupplier}
      />

      {/* Lens Content */}
      <div className="bg-white rounded-xl border border-border">
        {lens === "data" ? (
          <DataTable products={sorted} sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
        ) : (
          <VisualLens products={sorted} window={window} />
        )}
      </div>

      {/* Working Rhythm Prompts */}
      <RhythmPrompts rhythm={rhythm} />
    </div>
  );
}

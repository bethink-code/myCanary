import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link } from "react-router-dom";

interface ReorderItem {
  skuCode: string;
  productName: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  status: "OK" | "APPROACHING" | "REORDER";
  recommendedOrderQty: number;
  manufacturerName: string;
  manufacturerId: number | null;
}

interface LineState {
  qty: number;
  included: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildEmailDraft(
  manufacturerName: string,
  items: (ReorderItem & { qty: number })[],
  checkDate: Date
): string {
  const deliveryDate = new Date(checkDate);
  deliveryDate.setDate(deliveryDate.getDate() + 40);

  const subjectDate = formatDateShort(checkDate);
  const lines = items
    .map((item) => `  ${item.skuCode}  |  ${item.productName}  |  Qty: ${item.qty}`)
    .join("\n");

  // TODO: Pull business name, contact name, and email from client config
  return `Subject: Purchase Order — ${subjectDate}

Hi ${manufacturerName} team,

Please find our order below:

${lines}

Requested delivery date: ${formatDate(deliveryDate)}

Kind regards`;
}

export default function ReorderWorkflow() {
  const checkDate = useMemo(() => new Date(), []);

  const { data: allItems = [], isLoading, error } = useQuery<ReorderItem[]>({
    queryKey: ["reorder-check"],
    queryFn: () => apiRequest("/api/stock/reorder-check"),
  });

  // Only show items that need attention
  const actionItems = useMemo(
    () => allItems.filter((item) => item.status === "REORDER" || item.status === "APPROACHING"),
    [allItems]
  );

  // Group by manufacturer
  const grouped = useMemo(() => {
    const map = new Map<string, ReorderItem[]>();
    for (const item of actionItems) {
      const key = item.manufacturerName || "UNASSIGNED";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    // Sort groups: named manufacturers first alphabetically, UNASSIGNED last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "UNASSIGNED") return 1;
      if (b === "UNASSIGNED") return -1;
      return a.localeCompare(b);
    });
  }, [actionItems]);

  // Per-line editable state: keyed by skuCode
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({});

  // Initialize line states when data arrives
  const getLineState = useCallback(
    (item: ReorderItem): LineState => {
      if (lineStates[item.skuCode]) return lineStates[item.skuCode];
      return {
        qty: item.recommendedOrderQty,
        included: item.status === "REORDER",
      };
    },
    [lineStates]
  );

  const updateLine = (skuCode: string, patch: Partial<LineState>, item: ReorderItem) => {
    setLineStates((prev) => ({
      ...prev,
      [skuCode]: { ...getLineState(item), ...patch },
    }));
  };

  // Clipboard copy for a manufacturer group
  const handleCopyPO = async (manufacturerName: string, items: ReorderItem[]) => {
    const included = items
      .filter((item) => getLineState(item).included)
      .map((item) => ({ ...item, qty: getLineState(item).qty }));

    if (included.length === 0) return;

    const draft = buildEmailDraft(manufacturerName, included, checkDate);
    await navigator.clipboard.writeText(draft);
  };

  // Counts for header
  const reorderCount = allItems.filter((i) => i.status === "REORDER").length;
  const approachingCount = allItems.filter((i) => i.status === "APPROACHING").length;

  // Copied state per manufacturer
  const [copiedMfr, setCopiedMfr] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/stock"
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Stock Management
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reorder Workflow</h1>
          <p className="text-sm text-slate-500 mt-1">
            Stock check — {formatDate(checkDate)}
          </p>
        </div>
        {!isLoading && actionItems.length > 0 && (
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {reorderCount} Reorder
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {approachingCount} Approaching
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load reorder data: {(error as Error).message}
        </div>
      )}

      {/* All OK */}
      {!isLoading && !error && actionItems.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-green-600 text-lg font-semibold">All stock levels OK</div>
          <p className="text-green-600/70 text-sm mt-1">
            No products currently at or approaching reorder point.
          </p>
        </div>
      )}

      {/* Manufacturer groups */}
      {!isLoading &&
        grouped.map(([manufacturerName, items]) => {
          const displayName =
            manufacturerName === "UNASSIGNED"
              ? "UNASSIGNED"
              : `${manufacturerName.toUpperCase()} ORDER`;

          const includedItems = items.filter((item) => getLineState(item).included);

          const emailDraft =
            includedItems.length > 0
              ? buildEmailDraft(
                  manufacturerName,
                  includedItems.map((item) => ({
                    ...item,
                    qty: getLineState(item).qty,
                  })),
                  checkDate
                )
              : "";

          return (
            <div
              key={manufacturerName}
              className="bg-white rounded-xl border border-border overflow-hidden"
            >
              {/* Section header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-border">
                <h2 className="text-sm font-bold text-slate-700 tracking-wide uppercase">
                  {displayName}
                </h2>
              </div>

              {/* Product table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Product</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">SKU</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">
                        Current Stock
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">
                        Reorder Point
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">
                        Order Qty
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-slate-600">Include</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => {
                      const ls = getLineState(item);
                      const statusColor =
                        item.status === "REORDER"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700";

                      return (
                        <tr key={item.skuCode} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">
                            {item.productName}
                          </td>
                          <td className="px-4 py-2 font-mono text-slate-500 text-xs">
                            {item.skuCode}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">{item.currentStock}</td>
                          <td className="px-4 py-2 text-right font-mono">{item.reorderPoint}</td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={ls.qty}
                              onChange={(e) =>
                                updateLine(
                                  item.skuCode,
                                  { qty: Math.max(0, parseInt(e.target.value) || 0) },
                                  item
                                )
                              }
                              className="w-20 px-2 py-1 border border-border rounded text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={ls.included}
                              onChange={(e) =>
                                updateLine(item.skuCode, { included: e.target.checked }, item)
                              }
                              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-ring"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Email draft preview */}
              {includedItems.length > 0 && (
                <div className="px-4 py-4 border-t border-border bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Draft PO Email
                  </h3>
                  <textarea
                    readOnly
                    value={emailDraft}
                    rows={Math.min(emailDraft.split("\n").length + 1, 20)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono bg-white text-slate-700 resize-y focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      await handleCopyPO(manufacturerName, items);
                      setCopiedMfr(manufacturerName);
                      setTimeout(() => setCopiedMfr(null), 2000);
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    {copiedMfr === manufacturerName ? "Copied!" : "Approve & Copy PO"}
                  </button>
                </div>
              )}

              {includedItems.length === 0 && (
                <div className="px-4 py-3 border-t border-border bg-slate-50/50 text-xs text-slate-400">
                  No products selected — check the Include boxes above to generate a PO draft.
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

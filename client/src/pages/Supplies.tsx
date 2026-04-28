import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { formatDateShort, getStatusBadge, calcStockStatus } from "../lib/formatters";
import RecordMovementModal from "../components/RecordMovementModal";
import SupplyEditModal from "../components/SupplyEditModal";
import StockShell from "./stock/StockShell";
import type { StatusCardData } from "./stock/StatusCards";

// ---------- Types ----------

interface Supply {
  id: number;
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING";
  subcategory: string | null;
  unitOfMeasure: string | null;
  supplier: string | null;
  supplierContact: string | null;
  priceDescription: string | null;
  moq: string | null;
  leadTime: string | null;
  reorderPoint: number | null;
  moqStructured: number | null;
  moqUnit: string | null;
  caseRoundingRequired: boolean;
  unitsPerCase: number | null;
  notes: string | null;
  isActive: boolean;
  currentStock: number;
  byLocation: { THH: number; Zinchar: number; NutriMed: number };
}

interface SupplyTransaction {
  id: number;
  transactionType: string;
  quantity: number;
  transactionDate: string;
  location: string;
  reference: string | null;
  notes: string | null;
  manufacturerName: string | null;
  createdAt: string;
}

interface SupplyDetail extends Supply {
  transactions: SupplyTransaction[];
}

// ---------- Constants ----------

const CATEGORY_FILTERS = [
  { value: "", label: "All Categories" },
  { value: "RAW_MATERIAL", label: "Raw Materials" },
  { value: "PACKAGING", label: "Packaging" },
];

function getCategoryBadge(category: string) {
  if (category === "RAW_MATERIAL") return { label: "Raw Material", className: "bg-amber-100 text-amber-700" };
  if (category === "PACKAGING") return { label: "Packaging", className: "bg-blue-100 text-blue-700" };
  return { label: category, className: "bg-slate-100 text-slate-600" };
}

function fmtQty(n: number): string {
  return n === 0 ? "—" : n.toLocaleString();
}

// ---------- Component ----------

export default function Supplies() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [movementTarget, setMovementTarget] = useState<Supply | null>(null);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [creatingSupply, setCreatingSupply] = useState(false);

  const { data: supplies = [], isLoading } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: () => apiRequest("/api/supplies"),
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: { id?: number; data: Record<string, unknown> }) =>
      payload.id
        ? apiRequest(`/api/supplies/${payload.id}`, { method: "PATCH", body: JSON.stringify(payload.data) })
        : apiRequest("/api/supplies", { method: "POST", body: JSON.stringify(payload.data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
      invalidateStockData(qc);
      setEditingSupply(null);
      setCreatingSupply(false);
    },
  });

  // Detail query loads transactions inline alongside the supply.
  const { data: detail } = useQuery<SupplyDetail>({
    queryKey: ["supply-detail", expandedId],
    queryFn: () => apiRequest(`/api/supplies/${expandedId}`),
    enabled: expandedId !== null,
  });

  const filtered = supplies.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const rawMaterialsCount = supplies.filter((s) => s.category === "RAW_MATERIAL").length;
  const packagingCount = supplies.filter((s) => s.category === "PACKAGING").length;
  const statusCards: StatusCardData[] = [
    { label: "Total supplies", value: supplies.length, caption: "tracked items", severity: "neutral" },
    { label: "Raw materials", value: rawMaterialsCount, caption: "ingredients in use", severity: "neutral" },
    { label: "Packaging", value: packagingCount, caption: "labels, bottles, cases", severity: "neutral" },
  ];

  return (
    <StockShell
      title="Stock"
      subtitle="Raw materials and packaging tracked alongside finished goods."
      statusCards={statusCards}
    >
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search supplies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setCreatingSupply(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          New supply
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">THH</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Zinchar</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">NutriMed</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Reorder Point</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((supply) => {
                  const status = getStatusBadge(calcStockStatus(supply.currentStock, supply.reorderPoint));
                  const catBadge = getCategoryBadge(supply.category);
                  const isExpanded = expandedId === supply.id;
                  const loc = supply.byLocation ?? { THH: 0, Zinchar: 0, NutriMed: 0 };

                  return (
                    <>
                      <tr
                        key={supply.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : supply.id)}
                      >
                        <td className="px-4 py-3 font-medium text-primary">
                          {supply.name}
                          {supply.unitOfMeasure && (
                            <span className="text-slate-400 ml-2 text-xs">({supply.unitOfMeasure})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${catBadge.className}`}>
                            {catBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmtQty(loc.THH)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtQty(loc.Zinchar)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtQty(loc.NutriMed)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {supply.currentStock.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {supply.reorderPoint !== null ? supply.reorderPoint.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {supply.supplier ?? <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSupply(supply);
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${supply.id}-detail`}>
                          <td colSpan={10} className="bg-slate-50 px-6 py-4 space-y-4">
                            <SupplyUsedInList supplyId={supply.id} />

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Recent transactions
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovementTarget(supply);
                                  }}
                                  className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium"
                                >
                                  Record movement
                                </button>
                              </div>
                              {!detail ? (
                                <div className="flex justify-center py-4">
                                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                              ) : detail.transactions.length === 0 ? (
                                <p className="text-sm text-slate-400">No transactions recorded yet.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-slate-500">
                                      <th className="pb-2 font-medium">Date</th>
                                      <th className="pb-2 font-medium">Type</th>
                                      <th className="pb-2 font-medium">Location</th>
                                      <th className="pb-2 font-medium text-right">Qty</th>
                                      <th className="pb-2 font-medium">Reference</th>
                                      <th className="pb-2 font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {detail.transactions.map((tx) => (
                                      <tr key={tx.id}>
                                        <td className="py-2 text-slate-700">{formatDateShort(tx.transactionDate)}</td>
                                        <td className="py-2 text-slate-600">{tx.transactionType}</td>
                                        <td className="py-2 text-slate-600">{tx.location}</td>
                                        <td className="py-2 text-right font-mono">
                                          {tx.quantity > 0 ? "+" : ""}{tx.quantity.toLocaleString()}
                                        </td>
                                        <td className="py-2 text-slate-600">{tx.reference ?? "—"}</td>
                                        <td className="py-2 text-slate-500">{tx.notes ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No supplies match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
            Showing {filtered.length} of {supplies.length} supplies
          </div>
        </div>
      )}

      {movementTarget && (
        <RecordMovementModal
          subjectKind="supply"
          subjectId={movementTarget.id}
          subjectName={movementTarget.name}
          onClose={() => setMovementTarget(null)}
        />
      )}

      {(editingSupply || creatingSupply) && (
        <SupplyEditModal
          supply={editingSupply}
          saving={upsertMutation.isPending}
          onClose={() => {
            setEditingSupply(null);
            setCreatingSupply(false);
          }}
          onSave={(data) => upsertMutation.mutate({ id: editingSupply?.id, data })}
        />
      )}
    </StockShell>
  );
}

interface UsedInMapping {
  id: number;
  supplyId: number;
  skuCode: string;
  quantityPerUnit: number;
  notes: string | null;
}

function SupplyUsedInList({ supplyId }: { supplyId: number }) {
  const { data: mappings = [], isLoading } = useQuery<UsedInMapping[]>({
    queryKey: ["supply-mappings-by-supply", supplyId],
    queryFn: () => apiRequest(`/api/supply-mappings/by-supply/${supplyId}`),
  });

  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Used in (BOM)
      </h4>
      {isLoading ? (
        <div className="flex justify-start py-2">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : mappings.length === 0 ? (
        <p className="text-xs text-slate-400">
          Not yet mapped to any product. Add a BOM mapping in Settings → BOM Matrix.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {mappings.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-border text-xs"
            >
              <span className="font-mono text-slate-700">{m.skuCode}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-500">{m.quantityPerUnit}/unit</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "../lib/queryClient";
import { formatStock, formatDateShort, formatTimestamp } from "../lib/formatters";
import { invalidateStockData } from "../lib/invalidation";
import ErrorBox from "../components/ErrorBox";
import StickyActionBar from "../components/StickyActionBar";
import PageTabs from "../components/PageTabs";
import LoadingOverlay from "../components/LoadingOverlay";

interface StockItem {
  skuCode: string;
  productName: string;
  category: string;
  unitsPerCase: number | null;
  thhStock: number;
  eightEightStock: number;
}

interface AdjustmentHistory {
  id: number;
  skuCode: string;
  stockLocation: string;
  quantity: number;
  notes: string | null;
  reference: string | null;
  createdAt: string;
}

export default function StockAdjustment() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedSku = searchParams.get("sku") ?? "";

  const [tab, setTab] = useState("new");
  const [selectedSku, setSelectedSku] = useState(preselectedSku);
  const [selectedLocation, setSelectedLocation] = useState("THH");
  const [newQuantity, setNewQuantity] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ["stock-summary"],
    queryFn: () => apiRequest("/api/stock/summary"),
  });

  const { data: reasons = [] } = useQuery<string[]>({
    queryKey: ["adjustment-reasons"],
    queryFn: () => apiRequest("/api/stock/adjustment-reasons"),
  });

  const selectedProduct = products.find((p) => p.skuCode === selectedSku);
  const currentStock = selectedProduct
    ? selectedLocation === "THH"
      ? selectedProduct.thhStock
      : selectedProduct.eightEightStock
    : null;

  const delta = currentStock !== null && newQuantity !== ""
    ? parseInt(newQuantity) - currentStock
    : null;

  const adjustMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/stock/adjustment", {
        method: "POST",
        body: JSON.stringify({
          skuCode: selectedSku,
          stockLocation: selectedLocation,
          newQuantity: parseInt(newQuantity),
          reason,
          notes,
        }),
      }),
    onSuccess: (data) => {
      invalidateStockData(qc);
      if (data.noChange) {
        setSuccess("No adjustment needed — stock is already at that level.");
      } else {
        const d = parseInt(newQuantity) - (currentStock ?? 0);
        setSuccess(
          `Adjusted ${selectedProduct?.productName} at ${selectedLocation}: ${currentStock} → ${newQuantity} (${d > 0 ? "+" : ""}${d} units). Reason: ${reason}.`
        );
      }
      setNewQuantity("");
      setNotes("");
      setReason("");
    },
  });

  const canSubmit =
    selectedSku && selectedLocation && newQuantity !== "" && reason && notes && !adjustMutation.isPending;

  if (isLoading) return <LoadingOverlay message="Loading products..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Adjustment</h1>
          <p className="text-sm text-slate-500 mt-1">
            Correct stock levels with a reason. Every adjustment is recorded in the audit trail.
          </p>
        </div>
        <Link
          to="/stock"
          className="px-4 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          Back to Stock Levels
        </Link>
      </div>

      <PageTabs
        tabs={[{ id: "new", label: "New Adjustment" }, { id: "history", label: "History" }]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* New Adjustment tab */}
      {tab === "new" && (
        <div className="space-y-4">
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              {success}
            </div>
          )}

          {adjustMutation.isError && (
            <ErrorBox>{(adjustMutation.error as Error).message}</ErrorBox>
          )}

          <div className="bg-white rounded-xl border border-border p-6 space-y-5">
            {/* Product selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <select
                value={selectedSku}
                onChange={(e) => {
                  setSelectedSku(e.target.value);
                  setNewQuantity("");
                  setSuccess(null);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.skuCode} value={p.skuCode}>
                    {p.productName} ({p.skuCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock Location</label>
              <div className="flex gap-3">
                {["THH", "88"].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setSelectedLocation(loc); setNewQuantity(""); setSuccess(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedLocation === loc
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {loc === "THH" ? "THH Premises" : "8/8 Warehouse"}
                  </button>
                ))}
              </div>
            </div>

            {/* Current stock display */}
            {selectedProduct && (
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-sm text-slate-600">
                  Current {selectedLocation} stock:{" "}
                  <strong className="text-slate-900">
                    {formatStock(currentStock ?? 0, selectedProduct.unitsPerCase, selectedProduct.category)}
                  </strong>
                </p>
              </div>
            )}

            {/* New quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correct Quantity (units)</label>
              <input
                type="number"
                min={0}
                value={newQuantity}
                onChange={(e) => { setNewQuantity(e.target.value); setSuccess(null); }}
                placeholder="Enter the actual stock count"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {delta !== null && delta !== 0 && (
                <p className={`text-sm mt-1 font-medium ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                  Adjustment: {delta > 0 ? "+" : ""}{delta} units
                </p>
              )}
              {delta === 0 && newQuantity !== "" && (
                <p className="text-sm mt-1 text-slate-400">No change — stock is already at this level.</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a reason...</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe what happened — this is recorded in the audit trail"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <StickyActionBar>
            <button
              onClick={() => adjustMutation.mutate()}
              disabled={!canSubmit}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adjustMutation.isPending ? "Saving..." : "Record Adjustment"}
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <AdjustmentHistory />
      )}
    </div>
  );
}

function AdjustmentHistory() {
  const { data: history = [], isLoading } = useQuery<AdjustmentHistory[]>({
    queryKey: ["adjustment-history"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/stock/adjustments");
      } catch {
        return [];
      }
    },
  });

  if (isLoading) return <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>;

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-slate-400">
        No stock adjustments have been recorded yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Date</th>
            <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Product</th>
            <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Location</th>
            <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Change</th>
            <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {history.map((h) => (
            <tr key={h.id} className="hover:bg-slate-50/50">
              <td className="px-5 py-2.5">{formatTimestamp(h.createdAt)}</td>
              <td className="px-5 py-2.5 font-mono text-xs">{h.skuCode}</td>
              <td className="px-5 py-2.5">{h.stockLocation}</td>
              <td className={`px-5 py-2.5 font-mono font-medium ${h.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                {h.quantity > 0 ? "+" : ""}{h.quantity}
              </td>
              <td className="px-5 py-2.5 text-slate-500">{h.reference ?? h.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

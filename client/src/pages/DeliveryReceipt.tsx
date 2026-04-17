import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { Link, useNavigate } from "react-router-dom";
import StickyActionBar from "../components/StickyActionBar";
import PageTabs from "../components/PageTabs";
import { formatDateShort, formatTimestamp } from "../lib/formatters";

interface Product {
  id: number;
  skuCode: string;
  productName: string;
  category: string;
}

interface Supply {
  id: number;
  name: string;
}

type LineKind = "PRODUCT" | "SUPPLY";

interface DeliveryLine {
  kind: LineKind;
  skuCode: string;
  supplyId: number | null;
  sizeVariant: string;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  reference: string;
  quantity: number;
}

interface DeliveryHistoryEntry {
  deliveryNoteRef: string;
  date: string;
  productCount: number;
  totalUnits: number;
}

export default function DeliveryReceipt() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("history");
  const [deliveryNoteRef, setDeliveryNoteRef] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [stockLocation, setStockLocation] = useState("THH");
  const emptyLine = (): DeliveryLine => ({
    kind: "PRODUCT",
    skuCode: "",
    supplyId: null,
    sizeVariant: "",
    batchNumber: "",
    manufactureDate: "",
    expiryDate: "",
    reference: "",
    quantity: 0,
  });
  const [lines, setLines] = useState<DeliveryLine[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiRequest("/api/products"),
  });

  const { data: supplies = [] } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: () => apiRequest("/api/supplies"),
  });

  // Delivery history from stock transactions
  const { data: deliveryHistory = [] } = useQuery<DeliveryHistoryEntry[]>({
    queryKey: ["delivery-history"],
    queryFn: async () => {
      try {
        const txns = await apiRequest("/api/stock/transactions?type=DELIVERY_IN") as any[];
        // Group by delivery note ref
        const grouped = new Map<string, { date: string; skus: Set<string>; totalUnits: number }>();
        for (const tx of txns) {
          const ref = tx.reference || tx.deliveryNoteRef || "No reference";
          if (!grouped.has(ref)) {
            grouped.set(ref, { date: tx.createdAt || tx.date, skus: new Set(), totalUnits: 0 });
          }
          const entry = grouped.get(ref)!;
          if (tx.skuCode) entry.skus.add(tx.skuCode);
          entry.totalUnits += Math.abs(tx.quantity ?? 0);
        }
        return [...grouped.entries()].map(([ref, data]) => ({
          deliveryNoteRef: ref,
          date: data.date,
          productCount: data.skus.size,
          totalUnits: data.totalUnits,
        }));
      } catch {
        return [];
      }
    },
    enabled: tab === "history",
  });

  const addLine = () => {
    setLines([...lines, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof DeliveryLine, value: string | number) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      for (const line of lines) {
        if (line.quantity <= 0) {
          setError("Every line needs a positive quantity.");
          setSaving(false);
          return;
        }
        if (line.kind === "PRODUCT") {
          if (!line.skuCode || !line.batchNumber || !line.manufactureDate || !line.expiryDate) {
            setError("Product lines need SKU, batch number, manufacture date, and expiry date.");
            setSaving(false);
            return;
          }
          await apiRequest("/api/movements", {
            method: "POST",
            body: JSON.stringify({
              type: "DELIVERY_RECEIVED",
              subjectKind: "product",
              skuCode: line.skuCode,
              location: stockLocation,
              quantity: line.quantity,
              date: receivedDate,
              deliveryNoteRef: deliveryNoteRef || undefined,
              batchNumber: line.batchNumber,
              manufactureDate: line.manufactureDate,
              expiryDate: line.expiryDate,
              sizeVariant: line.sizeVariant || undefined,
            }),
          });
        } else {
          if (!line.supplyId) {
            setError("Every supply line needs a supply selected.");
            setSaving(false);
            return;
          }
          await apiRequest("/api/movements", {
            method: "POST",
            body: JSON.stringify({
              type: "DELIVERY_RECEIVED",
              subjectKind: "supply",
              supplyId: line.supplyId,
              quantity: line.quantity,
              date: receivedDate,
              reference: line.reference || deliveryNoteRef || undefined,
            }),
          });
        }
      }

      invalidateStockData(qc);
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["supplies"] });
      navigate("/stock");
    } catch (err: any) {
      setError(err.message ?? "Failed to record delivery.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          to="/stock"
          className="text-sm text-slate-500 hover:text-primary mb-1 inline-block"
        >
          &larr; Back to Stock Management
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Stock In: Record Delivery</h1>
        <p className="text-sm text-green-600 mt-1">
          Recording a delivery creates Stock In transactions — adding to on-hand inventory.
        </p>
      </div>

      <PageTabs
        tabs={[{ id: "history", label: "History" }, { id: "new", label: "New Delivery" }]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900">Recent Deliveries</h3>
            </div>
            {deliveryHistory.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Date</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Delivery Note Ref</th>
                    <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Products</th>
                    <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Total Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveryHistory.map((entry) => (
                    <tr key={entry.deliveryNoteRef} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-500">
                        {formatDateShort(entry.date)}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-slate-800">
                        {entry.deliveryNoteRef}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                        {entry.productCount}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                        {entry.totalUnits.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-slate-400">
                Recent deliveries will appear here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action tab: New Delivery */}
      {tab === "new" && <form onSubmit={handleSubmit} className="space-y-6">
        {/* Delivery Header */}
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Delivery Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Delivery Note Reference
              </label>
              <input
                type="text"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                placeholder="e.g. DN 3127"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Received Date *
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Stock Location *
              </label>
              <select
                value={stockLocation}
                onChange={(e) => setStockLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="THH">THH Premises</option>
                <option value="88">8/8 Warehouse</option>
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Items Delivered</h2>
            <button
              type="button"
              onClick={addLine}
              className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
            >
              + Add Line
            </button>
          </div>

          {lines.map((line, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 p-1 bg-white border border-border rounded-md text-xs">
                  <button
                    type="button"
                    onClick={() => updateLine(idx, "kind", "PRODUCT")}
                    className={`px-3 py-1 rounded ${
                      line.kind === "PRODUCT" ? "bg-primary text-primary-foreground" : "text-slate-600"
                    }`}
                  >
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLine(idx, "kind", "SUPPLY")}
                    className={`px-3 py-1 rounded ${
                      line.kind === "SUPPLY" ? "bg-primary text-primary-foreground" : "text-slate-600"
                    }`}
                  >
                    Supply
                  </button>
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="ml-auto px-2 py-1 text-red-500 hover:text-red-700 text-sm"
                    title="Remove line"
                  >
                    Remove
                  </button>
                )}
              </div>

              {line.kind === "PRODUCT" ? (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
                    <select
                      required
                      value={line.skuCode}
                      onChange={(e) => updateLine(idx, "skuCode", e.target.value)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.skuCode} value={p.skuCode}>
                          {p.productName} ({p.skuCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Size variant</label>
                    <input
                      type="text"
                      value={line.sizeVariant}
                      onChange={(e) => updateLine(idx, "sizeVariant", e.target.value)}
                      placeholder="e.g. 500g"
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Batch number *</label>
                    <input
                      type="text"
                      required
                      value={line.batchNumber}
                      onChange={(e) => updateLine(idx, "batchNumber", e.target.value)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mfg date *</label>
                    <input
                      type="date"
                      required
                      value={line.manufactureDate}
                      onChange={(e) => updateLine(idx, "manufactureDate", e.target.value)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expiry date *</label>
                    <input
                      type="date"
                      required
                      value={line.expiryDate}
                      onChange={(e) => updateLine(idx, "expiryDate", e.target.value)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Qty *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={line.quantity || ""}
                      onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supply *</label>
                    <select
                      required
                      value={line.supplyId ?? ""}
                      onChange={(e) => updateLine(idx, "supplyId", e.target.value ? parseInt(e.target.value) : null as any)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    >
                      <option value="">Select supply...</option>
                      {supplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
                    <input
                      type="text"
                      value={line.reference}
                      onChange={(e) => updateLine(idx, "reference", e.target.value)}
                      placeholder="PO / invoice (optional)"
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Qty *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={line.quantity || ""}
                      onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <StickyActionBar>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Record Delivery"}
          </button>
          <Link
            to="/stock"
            className="px-6 py-2 border border-border text-slate-700 rounded-lg text-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
        </StickyActionBar>
      </form>}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link, useNavigate } from "react-router-dom";
import StickyActionBar from "../components/StickyActionBar";

interface Product {
  id: number;
  skuCode: string;
  productName: string;
  category: string;
}

interface DeliveryLine {
  skuCode: string;
  sizeVariant: string;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  quantity: number;
}

export default function DeliveryReceipt() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deliveryNoteRef, setDeliveryNoteRef] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [stockLocation, setStockLocation] = useState("THH");
  const [lines, setLines] = useState<DeliveryLine[]>([
    {
      skuCode: "",
      sizeVariant: "",
      batchNumber: "",
      manufactureDate: "",
      expiryDate: "",
      quantity: 0,
    },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiRequest("/api/products"),
  });

  const addLine = () => {
    setLines([
      ...lines,
      {
        skuCode: "",
        sizeVariant: "",
        batchNumber: "",
        manufactureDate: "",
        expiryDate: "",
        quantity: 0,
      },
    ]);
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
        if (!line.skuCode || !line.batchNumber || !line.quantity) {
          setError("Please fill in all required fields for each line.");
          setSaving(false);
          return;
        }

        await apiRequest("/api/batches", {
          method: "POST",
          body: JSON.stringify({
            skuCode: line.skuCode,
            sizeVariant: line.sizeVariant,
            stockLocation,
            batchNumber: line.batchNumber,
            manufactureDate: line.manufactureDate,
            expiryDate: line.expiryDate,
            initialQuantity: line.quantity,
            receivedDate,
            deliveryNoteRef: deliveryNoteRef || undefined,
          }),
        });
      }

      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["snapshot-overview"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <h2 className="font-semibold text-slate-900">Products Delivered</h2>
            <button
              type="button"
              onClick={addLine}
              className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
            >
              + Add Line
            </button>
          </div>

          {lines.map((line, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end p-4 bg-slate-50 rounded-lg"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Product *
                </label>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Size Variant
                </label>
                <input
                  type="text"
                  value={line.sizeVariant}
                  onChange={(e) => updateLine(idx, "sizeVariant", e.target.value)}
                  placeholder="e.g. 500g"
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Batch Number *
                </label>
                <input
                  type="text"
                  required
                  value={line.batchNumber}
                  onChange={(e) => updateLine(idx, "batchNumber", e.target.value)}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mfg Date
                </label>
                <input
                  type="date"
                  value={line.manufactureDate}
                  onChange={(e) => updateLine(idx, "manufactureDate", e.target.value)}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={line.expiryDate}
                  onChange={(e) => updateLine(idx, "expiryDate", e.target.value)}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Qty *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={line.quantity || ""}
                    onChange={(e) =>
                      updateLine(idx, "quantity", parseInt(e.target.value) || 0)
                    }
                    className="w-full px-2 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="px-2 py-2 text-red-500 hover:text-red-700"
                    title="Remove line"
                  >
                    &times;
                  </button>
                )}
              </div>
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
      </form>
    </div>
  );
}

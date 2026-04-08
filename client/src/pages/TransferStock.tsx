import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link } from "react-router-dom";
import StickyActionBar from "../components/StickyActionBar";

interface StockItem {
  skuCode: string;
  productName: string;
  category: string;
  brand: string;
  unitsPerCase: number | null;
  thhStock: number;
  eightEightStock: number;
}

export default function TransferStock() {
  const qc = useQueryClient();
  const [selectedSku, setSelectedSku] = useState("");
  const [cases, setCases] = useState<number>(0);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ["stock-summary"],
    queryFn: () => apiRequest("/api/stock/summary"),
  });

  // Only show products that have THH stock and units_per_case (transferable in cases)
  const transferable = stockItems.filter(
    (i) => i.unitsPerCase && i.unitsPerCase > 0
  );

  const selected = transferable.find((i) => i.skuCode === selectedSku);
  const unitsToTransfer = selected ? cases * (selected.unitsPerCase ?? 1) : 0;

  const transferMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/stock/transfer", {
        method: "POST",
        body: JSON.stringify({ skuCode: selectedSku, cases }),
      }),
    onSuccess: () => {
      setSuccess(
        `Transferred ${cases} cases (${unitsToTransfer} units) of ${selected?.productName} from THH to 8/8.`
      );
      setSelectedSku("");
      setCases(0);
      setError("");
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["snapshot-overview"] });
    },
    onError: (err: any) => {
      setError(err.message ?? "Transfer failed.");
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/stock"
          className="text-sm text-slate-500 hover:text-primary mb-1 inline-block"
        >
          &larr; Back to Stock Management
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          Stock Transfer: THH to 8/8
        </h1>
        <p className="text-sm text-amber-600 mt-1">
          Transfers move stock between locations — Stock Out at THH, Stock In at 8/8.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Product *
          </label>
          <select
            value={selectedSku}
            onChange={(e) => {
              setSelectedSku(e.target.value);
              setSuccess("");
              setError("");
            }}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a product...</option>
            {transferable.map((p) => (
              <option key={p.skuCode} value={p.skuCode}>
                {p.productName} ({p.skuCode}) — THH: {p.thhStock} units, 8/8:{" "}
                {p.eightEightStock} units
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-500">Current THH Stock</p>
                <p className="text-lg font-bold text-slate-900">
                  {selected.thhStock} units (
                  {(selected.thhStock / (selected.unitsPerCase ?? 1)).toFixed(1)}{" "}
                  cases)
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Current 8/8 Stock</p>
                <p className="text-lg font-bold text-slate-900">
                  {selected.eightEightStock} units (
                  {(
                    selected.eightEightStock / (selected.unitsPerCase ?? 1)
                  ).toFixed(1)}{" "}
                  cases)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cases to Transfer *
              </label>
              <input
                type="number"
                min={1}
                value={cases || ""}
                onChange={(e) => setCases(parseInt(e.target.value) || 0)}
                className="w-48 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {cases > 0 && (
                <p className="text-sm text-slate-500 mt-1">
                  = {unitsToTransfer} units ({selected.unitsPerCase} per case)
                </p>
              )}
              {unitsToTransfer > selected.thhStock && (
                <p className="text-sm text-red-600 mt-1">
                  Warning: This exceeds current THH stock of {selected.thhStock}{" "}
                  units.
                </p>
              )}
            </div>

            <StickyActionBar>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={
                  !cases ||
                  cases <= 0 ||
                  transferMutation.isPending
                }
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
              >
                {transferMutation.isPending
                  ? "Transferring..."
                  : `Transfer ${cases} cases to 8/8`}
              </button>
            </StickyActionBar>
          </>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

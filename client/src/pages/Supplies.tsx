import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { formatDateShort, formatTimestamp, getStatusBadge, calcStockStatus } from "../lib/formatters";
import PageTabs from "../components/PageTabs";
import StickyActionBar from "../components/StickyActionBar";
import ErrorBox from "../components/ErrorBox";
import LoadingOverlay from "../components/LoadingOverlay";

// ---------- Types ----------

interface Supply {
  id: number;
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING";
  currentStock: number;
  reorderPoint: number | null;
  supplier: string | null;
  unit: string | null;
}

interface SupplyTransaction {
  id: number;
  supplyId: number;
  type: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  date: string;
  createdAt: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  manufacturer: string;
  status: string;
}

interface ImportPreviewRow {
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number | null;
  supplier: string | null;
  matchStatus: "MATCHED" | "NEW";
  matchedSupplyId?: number;
}

interface ImportPreviewResponse {
  rows: ImportPreviewRow[];
}

interface ImportCommitResponse {
  imported: number;
}

// ---------- Constants ----------

const CATEGORY_FILTERS = [
  { value: "", label: "All Categories" },
  { value: "RAW_MATERIAL", label: "Raw Materials" },
  { value: "PACKAGING", label: "Packaging" },
];

function getCategoryBadge(category: string) {
  if (category === "RAW_MATERIAL") {
    return { label: "Raw Material", className: "bg-amber-100 text-amber-700" };
  }
  if (category === "PACKAGING") {
    return { label: "Packaging", className: "bg-blue-100 text-blue-700" };
  }
  return { label: category, className: "bg-slate-100 text-slate-600" };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Component ----------

export default function Supplies() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("history");

  // ---- History state ----
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ---- Receive state ----
  const [receiveSupplyId, setReceiveSupplyId] = useState("");
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveRef, setReceiveRef] = useState("");
  const [receiveDate, setReceiveDate] = useState(todayISO());
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveSuccess, setReceiveSuccess] = useState("");

  // ---- Send state ----
  const [sendSupplyId, setSendSupplyId] = useState("");
  const [sendManufacturer, setSendManufacturer] = useState("");
  const [sendQty, setSendQty] = useState("");
  const [sendPoId, setSendPoId] = useState("");
  const [sendRef, setSendRef] = useState("");
  const [sendNotes, setSendNotes] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  // ---- Import state ----
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState("fetch");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importCount, setImportCount] = useState(0);

  // ---------- Queries ----------

  const { data: supplies = [], isLoading } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: () => apiRequest("/api/supplies"),
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<SupplyTransaction[]>({
    queryKey: ["supply-transactions", expandedId],
    queryFn: () => apiRequest(`/api/supplies/${expandedId}/transactions`),
    enabled: !!expandedId,
  });

  const { data: openPOs = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders-open"],
    queryFn: () => apiRequest("/api/purchase-orders?status=open"),
    enabled: tab === "send",
  });

  // ---------- Mutations ----------

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!receiveSupplyId) throw new Error("Please select a supply");
      if (!receiveQty || Number(receiveQty) <= 0) throw new Error("Please enter a valid quantity");

      return apiRequest("/api/supplies/receive", {
        method: "POST",
        body: JSON.stringify({
          supplyId: Number(receiveSupplyId),
          quantity: Number(receiveQty),
          reference: receiveRef || undefined,
          date: receiveDate,
          notes: receiveNotes || undefined,
        }),
      });
    },
    onSuccess: () => {
      setReceiveSuccess(`Successfully recorded receipt of ${receiveQty} units.`);
      setReceiveSupplyId("");
      setReceiveQty("");
      setReceiveRef("");
      setReceiveDate(todayISO());
      setReceiveNotes("");
      qc.invalidateQueries({ queryKey: ["supplies"] });
      invalidateStockData(qc);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!sendSupplyId) throw new Error("Please select a supply");
      if (!sendQty || Number(sendQty) <= 0) throw new Error("Please enter a valid quantity");
      if (!sendManufacturer) throw new Error("Please enter a manufacturer");

      return apiRequest("/api/supplies/send", {
        method: "POST",
        body: JSON.stringify({
          supplyId: Number(sendSupplyId),
          manufacturer: sendManufacturer,
          quantity: Number(sendQty),
          purchaseOrderId: sendPoId ? Number(sendPoId) : undefined,
          reference: sendRef || undefined,
          notes: sendNotes || undefined,
        }),
      });
    },
    onSuccess: () => {
      setSendSuccess(`Successfully recorded send of ${sendQty} units.`);
      setSendSupplyId("");
      setSendManufacturer("");
      setSendQty("");
      setSendPoId("");
      setSendRef("");
      setSendNotes("");
      qc.invalidateQueries({ queryKey: ["supplies"] });
      invalidateStockData(qc);
    },
  });

  const importPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) throw new Error("Please select a file");

      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/supplies/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? "Upload failed");
      }

      return res.json() as Promise<ImportPreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewRows(data.rows);
      setImportStep(2);
    },
  });

  const sheetPullMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/supplies/import/pull-sheet") as Promise<ImportPreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewRows(data.rows);
      setImportStep(2);
    },
  });

  const importCommitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/supplies/import/commit", {
        method: "POST",
        body: JSON.stringify({ items: previewRows }),
      }) as Promise<ImportCommitResponse>;
    },
    onSuccess: (data) => {
      setImportCount(data.imported);
      setImportStep(3);
      qc.invalidateQueries({ queryKey: ["supplies"] });
      invalidateStockData(qc);
    },
  });

  // ---------- Filtering ----------

  const filtered = supplies.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!s.name.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  // ---------- Drag & drop ----------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && /\.xlsx?$/.test(droppedFile.name)) {
      setImportFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setImportFile(selected);
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {receiveMutation.isPending && (
        <LoadingOverlay message="Recording supply receipt..." />
      )}
      {sendMutation.isPending && (
        <LoadingOverlay message="Recording supply send..." />
      )}
      {sheetPullMutation.isPending && (
        <LoadingOverlay message="Pulling supply data from Google Sheets..." submessage="Reading RAW MATERIALS and PACKAGING tabs." />
      )}
      {importPreviewMutation.isPending && (
        <LoadingOverlay message="Parsing spreadsheet..." />
      )}
      {importCommitMutation.isPending && (
        <LoadingOverlay
          message="Importing supplies..."
          submessage="Creating and updating supply records."
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supplies</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track raw materials and packaging. Receive deliveries, send to manufacturers, or import from the Animal Farm spreadsheet.
        </p>
      </div>

      <PageTabs
        tabs={[
          { id: "history", label: "History" },
          { id: "receive", label: "Receive" },
          { id: "send", label: "Send" },
        ]}
        activeTab={tab}
        onChange={(id) => {
          setTab(id);
          setReceiveSuccess("");
          setSendSuccess("");
          setImportStep(1);
        }}
      />

      {/* ===================== HISTORY TAB ===================== */}
      {tab === "history" && (
        <div className="space-y-4">
          {/* Filters */}
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
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
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
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Current Stock</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Reorder Point</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((supply) => {
                      const status = getStatusBadge(calcStockStatus(supply.currentStock, supply.reorderPoint));
                      const catBadge = getCategoryBadge(supply.category);
                      const isExpanded = expandedId === supply.id;

                      return (
                        <tr key={supply.id} className="group">
                          <td colSpan={6} className="p-0">
                            {/* Main row */}
                            <div
                              className="grid hover:bg-slate-50 cursor-pointer"
                              style={{ gridTemplateColumns: "1fr auto auto auto auto 1fr" }}
                              onClick={() => setExpandedId(isExpanded ? null : supply.id)}
                            >
                              <div className="px-4 py-3 font-medium text-primary">
                                {supply.name}
                                {supply.unit && (
                                  <span className="text-slate-400 ml-2 text-xs">({supply.unit})</span>
                                )}
                              </div>
                              <div className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${catBadge.className}`}>
                                  {catBadge.label}
                                </span>
                              </div>
                              <div className="px-4 py-3 text-right font-mono">
                                {supply.currentStock.toLocaleString()}
                              </div>
                              <div className="px-4 py-3 text-right font-mono">
                                {supply.reorderPoint !== null ? supply.reorderPoint.toLocaleString() : "—"}
                              </div>
                              <div className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                              <div className="px-4 py-3 text-slate-600">
                                {supply.supplier ?? <span className="text-slate-400">—</span>}
                              </div>
                            </div>

                            {/* Expanded transactions */}
                            {isExpanded && (
                              <div className="bg-slate-50 border-t border-border px-6 py-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                  Recent Transactions
                                </h4>
                                {txLoading ? (
                                  <div className="flex justify-center py-4">
                                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                  </div>
                                ) : transactions.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-500">
                                        <th className="pb-2 font-medium">Date</th>
                                        <th className="pb-2 font-medium">Type</th>
                                        <th className="pb-2 font-medium text-right">Qty</th>
                                        <th className="pb-2 font-medium">Reference</th>
                                        <th className="pb-2 font-medium">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {transactions.map((tx) => (
                                        <tr key={tx.id}>
                                          <td className="py-2 text-slate-700">{formatDateShort(tx.date)}</td>
                                          <td className="py-2">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                tx.type === "RECEIVE"
                                                  ? "bg-green-100 text-green-700"
                                                  : "bg-red-100 text-red-700"
                                              }`}
                                            >
                                              {tx.type === "RECEIVE" ? "Stock In" : "Stock Out"}
                                            </span>
                                          </td>
                                          <td className="py-2 text-right font-mono">
                                            {tx.type === "RECEIVE" ? "+" : "-"}{tx.quantity}
                                          </td>
                                          <td className="py-2 text-slate-600">{tx.reference ?? "—"}</td>
                                          <td className="py-2 text-slate-500">{tx.notes ?? "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-sm text-slate-400">No transactions recorded yet.</p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
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
        </div>
      )}

      {/* ===================== RECEIVE TAB ===================== */}
      {tab === "receive" && (
        <div className="space-y-4">
          {receiveSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {receiveSuccess}
            </div>
          )}

          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                Record Supply Receipt
              </h2>
              <p className="text-sm text-slate-500">
                Record an incoming delivery of raw materials or packaging.
              </p>
            </div>

            {/* Supply select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supply</label>
              <select
                value={receiveSupplyId}
                onChange={(e) => setReceiveSupplyId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a supply...</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getCategoryBadge(s.category).label})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Received</label>
              <input
                type="number"
                min="1"
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Delivery reference */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Reference</label>
              <input
                type="text"
                value={receiveRef}
                onChange={(e) => setReceiveRef(e.target.value)}
                placeholder="e.g. INV-2026-042"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes about this delivery..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {receiveMutation.isError && (
              <ErrorBox>{(receiveMutation.error as any)?.message ?? "Failed to record receipt"}</ErrorBox>
            )}
          </div>

          <StickyActionBar>
            <button
              onClick={() => receiveMutation.mutate()}
              disabled={!receiveSupplyId || !receiveQty || receiveMutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {receiveMutation.isPending ? "Recording..." : "Record Receipt"}
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ===================== SEND TAB ===================== */}
      {tab === "send" && (
        <div className="space-y-4">
          {sendSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {sendSuccess}
            </div>
          )}

          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                Record Supply Send
              </h2>
              <p className="text-sm text-slate-500">
                Record supplies sent to a manufacturer for production.
              </p>
            </div>

            {/* Supply select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supply</label>
              <select
                value={sendSupplyId}
                onChange={(e) => setSendSupplyId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a supply...</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getCategoryBadge(s.category).label})
                  </option>
                ))}
              </select>
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={sendManufacturer}
                onChange={(e) => setSendManufacturer(e.target.value)}
                placeholder="e.g. Zinchar, Nutrimed"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Sent</label>
              <input
                type="number"
                min="1"
                value={sendQty}
                onChange={(e) => setSendQty(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Link to PO */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Link to Purchase Order <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={sendPoId}
                onChange={(e) => setSendPoId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No linked PO</option>
                {openPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.manufacturer}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input
                type="text"
                value={sendRef}
                onChange={(e) => setSendRef(e.target.value)}
                placeholder="e.g. Batch ref or waybill number"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={sendNotes}
                onChange={(e) => setSendNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes about this send..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {sendMutation.isError && (
              <ErrorBox>{(sendMutation.error as any)?.message ?? "Failed to record send"}</ErrorBox>
            )}
          </div>

          <StickyActionBar>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!sendSupplyId || !sendQty || !sendManufacturer || sendMutation.isPending}
              className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? "Recording..." : "Record Send"}
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ===================== IMPORT TAB ===================== */}
      {tab === "import" && importStep === 1 && (
        <div className="space-y-4">
          <PageTabs
            tabs={[{ id: "fetch", label: "Fetch" }, { id: "upload", label: "Upload" }]}
            activeTab={importMode}
            onChange={(id) => setImportMode(id)}
          />

          {/* Fetch from Google Sheets */}
          {importMode === "fetch" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Pull from Animal Farm Google Sheet
                </h2>
                <p className="text-sm text-slate-500">
                  Reads the RAW MATERIALS and PACKAGING tabs directly from Google Drive.
                </p>
              </div>

              {sheetPullMutation.isError && (
                <ErrorBox>{(sheetPullMutation.error as any)?.message ?? "Pull failed"}</ErrorBox>
              )}

              <StickyActionBar>
                <button
                  onClick={() => sheetPullMutation.mutate()}
                  disabled={sheetPullMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sheetPullMutation.isPending ? "Pulling from Google Sheets..." : "Pull Supply Data from Google Sheets"}
                </button>
              </StickyActionBar>
            </div>
          )}

          {/* Upload Excel file */}
          {importMode === "upload" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Upload Animal Farm Spreadsheet
                </h2>
                <p className="text-sm text-slate-500">
                  Upload the Animal Farm Excel file to import RAW MATERIALS and PACKAGING data.
                </p>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : importFile
                      ? "border-green-300 bg-green-50"
                      : "border-slate-300 hover:border-slate-400"
                }`}
                onClick={() => document.getElementById("supply-file-input")?.click()}
              >
                <input
                  id="supply-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {importFile ? (
                  <div>
                    <div className="text-green-700 font-medium">{importFile.name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {(importFile.size / 1024).toFixed(1)} KB — Click or drop to replace
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-slate-600 font-medium">
                      Drop your Excel file here, or click to browse
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      Accepts .xlsx and .xls files
                    </div>
                  </div>
                )}
              </div>

              {importPreviewMutation.isError && (
                <ErrorBox>{(importPreviewMutation.error as any)?.message ?? "Upload failed"}</ErrorBox>
              )}

              <StickyActionBar>
                <button
                  onClick={() => importPreviewMutation.mutate()}
                  disabled={!importFile || importPreviewMutation.isPending}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importPreviewMutation.isPending ? "Uploading..." : "Upload & Preview"}
                </button>
              </StickyActionBar>
            </div>
          )}
        </div>
      )}

      {tab === "import" && importStep === 2 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-border p-4 flex gap-6 text-sm">
            <div>
              <span className="font-medium text-green-700">
                {previewRows.filter((r) => r.matchStatus === "MATCHED").length}
              </span>{" "}
              <span className="text-slate-600">matched (will update)</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">
                {previewRows.filter((r) => r.matchStatus === "NEW").length}
              </span>{" "}
              <span className="text-slate-600">new supplies</span>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Stock</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Reorder Point</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row, idx) => {
                    const catBadge = getCategoryBadge(row.category);
                    const isNew = row.matchStatus === "NEW";
                    return (
                      <tr key={idx} className={isNew ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${catBadge.className}`}>
                            {catBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{row.currentStock}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {row.reorderPoint !== null ? row.reorderPoint : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.supplier ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              isNew
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {isNew ? "New" : "Matched"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No rows parsed from the file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
              {previewRows.length} supplies parsed from spreadsheet
            </div>
          </div>

          {importCommitMutation.isError && (
            <ErrorBox>{(importCommitMutation.error as any)?.message ?? "Import failed"}</ErrorBox>
          )}

          <StickyActionBar>
            <button
              onClick={() => importCommitMutation.mutate()}
              disabled={importCommitMutation.isPending || previewRows.length === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importCommitMutation.isPending
                ? "Importing..."
                : `Import ${previewRows.length} Supplies`}
            </button>
            <button
              onClick={() => {
                setImportStep(1);
                setPreviewRows([]);
                importPreviewMutation.reset();
              }}
              disabled={importCommitMutation.isPending}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </StickyActionBar>
        </div>
      )}

      {tab === "import" && importStep === 3 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Import Complete</h2>
          <p className="text-slate-600">
            Successfully imported <span className="font-semibold">{importCount}</span> supplies from the spreadsheet.
          </p>
          <div className="pt-4">
            <button
              onClick={() => {
                setImportStep(1);
                setImportFile(null);
                setPreviewRows([]);
                setTab("history");
              }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              View Supplies
            </button>
          </div>
        </div>
      )}

      {/* Bottom padding for StickyActionBar */}
      {(tab === "receive" || tab === "send" || (tab === "import" && importStep !== 3)) && (
        <div className="h-20" />
      )}
    </div>
  );
}

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { Link } from "react-router-dom";
import LoadingOverlay from "../components/LoadingOverlay";
import StickyActionBar from "../components/StickyActionBar";
import ErrorBox from "../components/ErrorBox";
import { formatDateLong, formatTimestamp } from "../lib/formatters";

interface ParsedRow {
  itemCode: string;
  baseSku: string;
  channel: string;
  channelName: string;
  productName: string;
  quantity: number;
  mapped: boolean;
  skippedReason?: string;
}

interface PreviewResponse {
  rows: ParsedRow[];
}

interface CommitResponse {
  transactionsCreated: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  D: "Direct",
  W: "Wholesale",
  R: "Retail",
  C: "PnP",
  G: "AP-Brand",
};

function getRowStatus(row: ParsedRow): { label: string; color: string } {
  if (row.channel === "C") {
    return { label: "Skipped (PnP)", color: "bg-slate-100 text-slate-500" };
  }
  if (row.skippedReason) {
    return { label: `Skipped: ${row.skippedReason}`, color: "bg-slate-100 text-slate-500" };
  }
  if (row.mapped) {
    return { label: "Mapped", color: "bg-green-100 text-green-700" };
  }
  return { label: "Unknown SKU", color: "bg-red-100 text-red-700" };
}

interface ImportHistoryEntry {
  reference: string;
  fromDate: string | null;
  toDate: string | null;
  transactionCount: number;
  totalUnits: number;
  importedAt: string;
}

export default function XeroImport() {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<"api" | "file">("api");

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Step 2 state
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [rawLineItems, setRawLineItems] = useState<any[]>([]); // Individual invoice lines for commit
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Step 3 state
  const [commitCount, setCommitCount] = useState(0);

  // Ledger start date — sales can only be imported after this date
  const { data: ledgerData } = useQuery<{ ledgerStartDate: string | null; hasOpeningBalance: boolean }>({
    queryKey: ["ledger-date"],
    queryFn: () => apiRequest("/api/xero/import/ledger-date"),
  });

  const ledgerStartDate = ledgerData?.ledgerStartDate ?? null;
  const hasOpeningBalance = ledgerData?.hasOpeningBalance ?? false;

  // Upload / preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please select a file");
      if (!fromDate || !toDate) throw new Error("Please select both dates");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("fromDate", fromDate);
      formData.append("toDate", toDate);

      const res = await fetch("/api/xero/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? "Upload failed");
      }

      return res.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewRows(data.rows);
      setStep(2);
    },
  });

  // Xero connection status
  const { data: xeroStatus } = useQuery<any>({
    queryKey: ["xero-status"],
    queryFn: () => apiRequest("/api/xero/status"),
  });

  // Import history
  const { data: importHistory = [] } = useQuery<ImportHistoryEntry[]>({
    queryKey: ["xero-import-history"],
    queryFn: () => apiRequest("/api/xero/import/history"),
  });

  // Check if period already imported
  const periodAlreadyImported = importHistory.some(
    (h) => h.fromDate === fromDate && h.toDate === toDate
  );

  // Check if from date is before ledger start
  const fromDateBeforeLedger = ledgerStartDate && fromDate && fromDate < ledgerStartDate;

  // API pull mutation
  const apiPullMutation = useMutation({
    mutationFn: async () => {
      if (!fromDate || !toDate) throw new Error("Please select both dates");
      const data = await apiRequest(
        `/api/xero/sales-report?fromDate=${fromDate}&toDate=${toDate}`
      );
      return data;
    },
    onSuccess: (data) => {
      // Store raw line items for commit (individual invoice-level transactions)
      setRawLineItems(data.lineItems ?? []);
      setInvoiceCount(data.invoiceCount ?? 0);

      // Convert aggregated summary to ParsedRow format for preview
      const rows: ParsedRow[] = (data.summary ?? []).map((r: any) => {
        const rawCode = r.itemCode;
        const channelCode = rawCode.slice(-1).toUpperCase();
        const validChannels = ["D", "W", "R", "C", "G"];
        const isValidChannel = validChannels.includes(channelCode);
        const baseSku = isValidChannel ? rawCode.slice(0, -1) : rawCode;
        const channel = isValidChannel ? channelCode : "?";

        return {
          itemCode: rawCode,
          baseSku,
          channel,
          channelName: CHANNEL_LABELS[channel] ?? "Unknown",
          productName: r.description || baseSku,
          quantity: Math.abs(r.quantity),
          mapped: true,
          skippedReason: channel === "C" ? "PnP channel — no THH stock debit" : undefined,
        };
      });
      setPreviewRows(rows);
      setStep(2);
    },
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: async () => {
      // If we have raw line items (API pull), send those for per-invoice traceability
      if (rawLineItems.length > 0) {
        const validChannels = ["D", "W", "R", "C", "G"];
        const commitRows = rawLineItems
          .filter((li: any) => {
            const ch = li.itemCode.slice(-1).toUpperCase();
            return validChannels.includes(ch) && ch !== "C" && li.quantity > 0;
          })
          .map((li: any) => {
            const ch = li.itemCode.slice(-1).toUpperCase();
            const baseSku = li.itemCode.slice(0, -1);
            return {
              baseSku,
              channel: ch,
              quantity: Math.abs(li.quantity),
              invoiceNumber: li.invoiceNumber,
            };
          });

        const result = await apiRequest("/api/xero/import/commit", {
          method: "POST",
          body: JSON.stringify({
            rows: commitRows,
            fromDate,
            toDate,
          }),
        });
        return result as CommitResponse;
      }

      // Fallback: file upload mode — send aggregated rows
      const commitRows = previewRows
        .filter((r) => r.mapped && r.channel !== "C" && !r.skippedReason && r.quantity > 0)
        .map((r) => ({
          baseSku: r.baseSku,
          channel: r.channel,
          quantity: r.quantity,
        }));

      const result = await apiRequest("/api/xero/import/commit", {
        method: "POST",
        body: JSON.stringify({
          rows: commitRows,
          fromDate,
          toDate,
        }),
      });
      return result as CommitResponse;
    },
    onSuccess: (data) => {
      setCommitCount(data.transactionsCreated);
      qc.invalidateQueries({ queryKey: ["xero-import-history"] });
      invalidateStockData(qc);
      setStep(3);
    },
  });

  // Month presets - generate last 12 months
  const monthPresets = (() => {
    const presets: { label: string; from: string; to: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0);
      const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      presets.push({ label, from: firstDay, to: lastDayStr });
    }
    return presets;
  })();

  const applyPreset = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  // Drag & drop handlers
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
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  // Summary stats for step 2

  const mappedCount = previewRows.filter((r) => r.mapped && r.channel !== "C" && !r.skippedReason).length;
  const skippedCount = previewRows.filter((r) => r.channel === "C" || !!r.skippedReason).length;
  const unknownCount = previewRows.filter((r) => !r.mapped && r.channel !== "C" && !r.skippedReason).length;

  return (
    <div className="space-y-6">
      {apiPullMutation.isPending && (
        <LoadingOverlay
          message="Pulling sales data from Xero..."
          submessage="This may take 30–60 seconds depending on the number of invoices."
        />
      )}
      {previewMutation.isPending && (
        <LoadingOverlay
          message="Parsing uploaded file..."
        />
      )}
      {commitMutation.isPending && (
        <LoadingOverlay
          message="Importing stock transactions..."
          submessage="Creating Stock Out records for each mapped item."
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Out: Xero Sales Import</h1>
          <p className="text-sm text-red-600 mt-1">Importing sales data creates Stock Out transactions — debiting from on-hand inventory.</p>
        </div>
        <Link
          to="/stock"
          className="px-4 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          Back to Stock Management
        </Link>
      </div>

      {/* Step 1: Import Source */}
      {step === 1 && (
        <div className="space-y-4">
          {/* No opening balance warning */}
          {!hasOpeningBalance && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <strong>Opening balance required.</strong> You need to import opening balances first to establish a ledger start date.
              Sales imports can only cover periods <em>after</em> the opening balance date.
              <Link to="/stock/opening-balance" className="ml-2 font-medium text-amber-900 underline">
                Import Opening Balances
              </Link>
            </div>
          )}

          {/* Ledger start date info */}
          {ledgerStartDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              Ledger start date: <strong>{formatDateLong(ledgerStartDate)}</strong>.
              Sales imports must cover periods after this date — earlier sales are already accounted for in the opening balance.
            </div>
          )}

          {/* Import History */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900">Past Imports</h3>
            </div>
            {importHistory.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Period</th>
                    <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Items</th>
                    <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Total Units</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Imported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importHistory.map((entry) => {
                    const from = entry.fromDate ? new Date(entry.fromDate) : null;
                    const periodLabel = from
                      ? from.toLocaleString("default", { month: "long", year: "numeric" })
                      : entry.reference;

                    return (
                      <tr key={entry.reference} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-medium text-slate-800">
                          {periodLabel}
                          <span className="text-xs text-slate-400 ml-2">
                            {entry.fromDate} — {entry.toDate}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                          {entry.transactionCount}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                          {entry.totalUnits.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500">
                          {formatTimestamp(entry.importedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-slate-400">
                No imports yet. Select a month below to pull sales data from Xero.
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setImportMode("api")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                importMode === "api"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-slate-600 hover:bg-slate-50"
              }`}
            >
              Pull from Xero API
            </button>
            <button
              onClick={() => setImportMode("file")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                importMode === "file"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-slate-600 hover:bg-slate-50"
              }`}
            >
              Upload Excel File
            </button>
          </div>

          {/* API Pull mode */}
          {importMode === "api" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Pull Sales Data from Xero
                </h2>
                <p className="text-sm text-slate-500">
                  {xeroStatus?.connected
                    ? `Connected to ${xeroStatus.organisationName}. Select a date range to pull invoice data.`
                    : "Xero is not connected. Please connect via Settings first, or use file upload."}
                </p>
              </div>

              {xeroStatus?.connected ? (
                <>
                  {/* Month presets */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Quick Select Month
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {monthPresets.map((p) => (
                        <button
                          key={p.from}
                          onClick={() => applyPreset(p.from, p.to)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            fromDate === p.from && toDate === p.to
                              ? "bg-primary text-primary-foreground"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {apiPullMutation.isError && (
                    <ErrorBox>
                      {(apiPullMutation.error as any)?.message ?? "Failed to pull data from Xero"}
                    </ErrorBox>
                  )}

                  {/* Date before ledger start warning */}
                  {fromDateBeforeLedger && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                      <strong>Note:</strong> From Date is before the ledger start date ({ledgerStartDate}). Opening balances already account for sales up to that date — importing earlier sales may cause double-counting.
                    </div>
                  )}

                  {periodAlreadyImported && fromDate && toDate && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                      This period ({fromDate} to {toDate}) has been imported before. Re-importing will replace the previous data for this period.
                    </div>
                  )}

                  <StickyActionBar>
                    <button
                      onClick={() => apiPullMutation.mutate()}
                      disabled={!fromDate || !toDate || apiPullMutation.isPending}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {apiPullMutation.isPending ? "Pulling from Xero..." : "Pull Sales Data"}
                    </button>
                  </StickyActionBar>
                </>
              ) : (
                <Link
                  to="/settings"
                  className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                >
                  Go to Settings to Connect Xero
                </Link>
              )}
            </div>
          )}

          {/* File Upload mode */}
          {importMode === "file" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Upload Xero Sales by Item Report
                </h2>
                <p className="text-sm text-slate-500">
                  Export the "Sales by Item" report from Xero as an Excel file, then upload it here.
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
                    : file
                      ? "border-green-300 bg-green-50"
                      : "border-slate-300 hover:border-slate-400"
                }`}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <div className="text-green-700 font-medium">{file.name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB - Click or drop to replace
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

              {/* Month presets */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quick Select Month
                </label>
                <div className="flex flex-wrap gap-2">
                  {monthPresets.map((p) => (
                    <button
                      key={p.from}
                      onClick={() => applyPreset(p.from, p.to)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        fromDate === p.from && toDate === p.to
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period selection */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Date before ledger start warning */}
              {fromDateBeforeLedger && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                  <strong>Note:</strong> From Date is before the ledger start date ({ledgerStartDate}). Opening balances already account for sales up to that date — importing earlier sales may cause double-counting.
                </div>
              )}

              {periodAlreadyImported && fromDate && toDate && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                  This period ({fromDate} to {toDate}) has been imported before. Re-importing will replace the previous data for this period.
                </div>
              )}

              {/* Error */}
              {previewMutation.isError && (
                <ErrorBox>{previewMutation.error.message}</ErrorBox>
              )}

              {/* Upload button */}
              <StickyActionBar>
                <button
                  onClick={() => previewMutation.mutate()}
                  disabled={!file || !fromDate || !toDate || previewMutation.isPending}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewMutation.isPending ? "Uploading..." : "Upload & Preview"}
                </button>
              </StickyActionBar>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-border p-4 flex gap-6 text-sm">
            <div>
              <span className="font-medium text-green-700">{mappedCount}</span>{" "}
              <span className="text-slate-600">items mapped</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">{skippedCount}</span>{" "}
              <span className="text-slate-600">skipped (PnP / other)</span>
            </div>
            <div>
              <span className="font-medium text-red-600">{unknownCount}</span>{" "}
              <span className="text-slate-600">unknown</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Item Code (Raw)
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Mapped SKU
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Channel
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Product Name
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Quantity
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row, idx) => {
                    const status = getRowStatus(row);
                    const isPnP = row.channel === "C";
                    const isUnknown = !row.mapped && !isPnP && !row.skippedReason;

                    return (
                      <tr
                        key={`${row.itemCode}-${idx}`}
                        className={
                          isPnP
                            ? "bg-slate-50 text-slate-400"
                            : isUnknown
                              ? "bg-red-50"
                              : "hover:bg-slate-50"
                        }
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.itemCode}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.baseSku || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                            {row.channel}
                          </span>
                          <span className="ml-1 text-slate-500 text-xs">
                            {CHANNEL_LABELS[row.channel] ?? row.channelName}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.productName}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {row.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {previewRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No rows parsed from the file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
              {previewRows.length} rows parsed from report
              {previewRows.some((r) => r.channel === "C") && (
                <span className="ml-2">
                  — PnP rows shown in grey (no THH debit)
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {commitMutation.isError && (
            <ErrorBox>{commitMutation.error.message}</ErrorBox>
          )}

          {/* Actions */}
          <StickyActionBar>
            <button
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending || mappedCount === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {commitMutation.isPending ? "Importing..." : "Confirm & Import"}
            </button>
            <button
              onClick={() => {
                setStep(1);
                setPreviewRows([]);
                previewMutation.reset();
              }}
              disabled={commitMutation.isPending}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">
            Import Complete
          </h2>
          <p className="text-slate-600">
            Successfully created{" "}
            <span className="font-semibold">{commitCount}</span> stock
            transactions from the Xero sales report.
          </p>
          <p className="text-sm text-slate-500">
            Period: {fromDate} to {toDate}
          </p>
          <div className="pt-4">
            <Link
              to="/stock"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Back to Stock Management
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

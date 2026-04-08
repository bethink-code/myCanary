import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { Link } from "react-router-dom";
import StickyActionBar from "../components/StickyActionBar";
import ErrorBox from "../components/ErrorBox";
import PageTabs from "../components/PageTabs";
import { formatDateShort, formatTimestamp } from "../lib/formatters";

// ─── PnP DC reference data ─────────────────────────────────────
const PNP_DCS: Record<string, string> = {
  MA15: "PnP Eastport Inland DC (Gauteng)",
  MA05: "Philippi DC Groceries (Western Cape)",
  KC37: "Cornubia (KwaZulu-Natal)",
  KC19: "Hyper Midlands Mall (KwaZulu-Natal)",
  EF05: "Family Queenstown (Eastern Cape)",
};
const DC_CODES = Object.keys(PNP_DCS);

// ─── Types ──────────────────────────────────────────────────────
interface ParsedLine {
  pnpProductName: string;
  skuCode: string | null;
  matched: boolean;
  dcQuantities: Record<string, number>;
}

interface UploadResponse {
  weekEndingDate: string;
  appointmentTime: string | null;
  fileName: string;
  lines: ParsedLine[];
}

interface OrderLine {
  id: number;
  pnpOrderId: number;
  skuCode: string;
  dcCode: string;
  dcName: string;
  orderedCases: number;
  orderedUnits: number;
  availableCases: number | null;
  shortfallCases: number | null;
}

interface CreateResponse {
  order: { id: number; weekEndingDate: string; status: string };
  lines: OrderLine[];
  stockCheck: Record<string, { availableUnits: number; availableCases: number }>;
}

interface DispatchInstructionResponse {
  subject: string;
  body: string;
  order: any;
}

interface DispatchResponse {
  success: boolean;
  orderId: number;
  transactionsCreated: number;
  lowStockAlerts: string[];
}

interface ProductOption {
  skuCode: string;
  productName: string;
}

interface PnpOrder {
  id: number;
  weekEndingDate: string;
  status: string;
  createdAt: string;
}

export default function PnpWeekly() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("history");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [weekEndingDate, setWeekEndingDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Step 2 state
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [fileName, setFileName] = useState("");
  const [manualSkuOverrides, setManualSkuOverrides] = useState<Record<number, string>>({});

  // Step 3 state
  const [createdOrder, setCreatedOrder] = useState<CreateResponse | null>(null);

  // Step 4 state
  const [emailBody, setEmailBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [xeroInvoiceRef, setXeroInvoiceRef] = useState("");
  const [copied, setCopied] = useState(false);

  // Step 5 state
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);

  // Load product list for manual SKU dropdown
  const { data: productList } = useQuery<ProductOption[]>({
    queryKey: ["products-list"],
    queryFn: () => apiRequest("/api/products"),
    staleTime: 10 * 60 * 1000,
  });

  // Past PnP orders for history tab
  const { data: pnpOrders = [] } = useQuery<PnpOrder[]>({
    queryKey: ["pnp-orders"],
    queryFn: () => apiRequest("/api/pnp/orders"),
    enabled: tab === "history",
  });

  // ─── Step 1: Upload & parse ─────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please select a file");
      if (!weekEndingDate) throw new Error("Please select a week ending date");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("weekEndingDate", weekEndingDate);
      if (appointmentTime) formData.append("appointmentTime", appointmentTime);

      const res = await fetch("/api/pnp/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? "Upload failed");
      }

      return res.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      setParsedLines(data.lines);
      setFileName(data.fileName);
      setManualSkuOverrides({});
      setStep(2);
    },
  });

  // ─── Step 2 → 3: Create order ──────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      // Build flat lines: one entry per SKU per DC
      const flatLines: Array<{
        skuCode: string;
        dcCode: string;
        dcName: string;
        orderedCases: number;
        orderedUnits: number;
      }> = [];

      for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        const sku = manualSkuOverrides[i] ?? line.skuCode;
        if (!sku) continue;

        for (const dc of DC_CODES) {
          const cases = line.dcQuantities[dc] ?? 0;
          if (cases === 0) continue;

          // We send cases — backend calculates units from product master
          // For now, units = cases (backend can adjust with unitsPerCase)
          flatLines.push({
            skuCode: sku,
            dcCode: dc,
            dcName: PNP_DCS[dc],
            orderedCases: cases,
            orderedUnits: cases, // Will be refined by backend if needed
          });
        }
      }

      if (flatLines.length === 0) throw new Error("No valid lines to create");

      const result: CreateResponse = await apiRequest("/api/pnp/create", {
        method: "POST",
        body: JSON.stringify({
          weekEndingDate,
          appointmentTime: appointmentTime || null,
          fileName,
          lines: flatLines,
        }),
      });
      return result;
    },
    onSuccess: (data) => {
      setCreatedOrder(data);
      setStep(3);
    },
  });

  // ─── Step 3 → 4: Fetch dispatch instruction ────────────────
  const fetchDispatchInstruction = async (orderId: number) => {
    const data: DispatchInstructionResponse = await apiRequest(
      `/api/pnp/orders/${orderId}/dispatch-instruction`
    );
    setEmailSubject(data.subject);
    let body = data.body;
    if (xeroInvoiceRef) {
      body = body.replace("[TO BE ADDED]", xeroInvoiceRef);
    }
    setEmailBody(body);
    setStep(4);
  };

  // ─── Step 4 → 5: Dispatch ──────────────────────────────────
  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!createdOrder) throw new Error("No order to dispatch");
      const result: DispatchResponse = await apiRequest(
        `/api/pnp/orders/${createdOrder.order.id}/dispatch`,
        { method: "POST" }
      );
      return result;
    },
    onSuccess: (data) => {
      setDispatchResult(data);
      invalidateStockData(qc);
      setStep(5);
    },
  });

  // ─── Drag & drop handlers ──────────────────────────────────
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
    if (droppedFile && /\.(xlsx?|csv)$/i.test(droppedFile.name)) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  // ─── Copy to clipboard ─────────────────────────────────────
  const handleCopy = async () => {
    let finalBody = emailBody;
    if (xeroInvoiceRef) {
      finalBody = finalBody.replace("[TO BE ADDED]", xeroInvoiceRef);
    }
    try {
      await navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${finalBody}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = `Subject: ${emailSubject}\n\n${finalBody}`;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── Summary stats ─────────────────────────────────────────
  const matchedCount = parsedLines.filter((l) => l.matched || manualSkuOverrides[parsedLines.indexOf(l)]).length;
  const unmatchedCount = parsedLines.filter(
    (l, i) => !l.matched && !manualSkuOverrides[i]
  ).length;

  // Step 3 shortfall stats
  const shortfallLines = createdOrder?.lines.filter((l) => (l.shortfallCases ?? 0) > 0) ?? [];

  // ─── Step indicator ─────────────────────────────────────────
  const steps = [
    { num: 1, label: "Upload" },
    { num: 2, label: "Review" },
    { num: 3, label: "Stock Check" },
    { num: 4, label: "Dispatch Instruction" },
    { num: 5, label: "Complete" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PnP Weekly Process</h1>
          <p className="text-sm text-red-600 mt-1">Dispatching creates Stock Out transactions at the 8/8 warehouse.</p>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          Back to Dashboard
        </Link>
      </div>

      <PageTabs
        tabs={[{ id: "history", label: "History" }, { id: "new", label: "New Dispatch" }]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900">Past PnP Dispatches</h3>
            </div>
            {pnpOrders.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Week Ending</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Status</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Dispatched On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pnpOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-medium text-slate-800">
                        {formatDateShort(order.weekEndingDate)}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "dispatched"
                            ? "bg-green-100 text-green-700"
                            : order.status === "created"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">
                        {formatTimestamp(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-slate-400">
                No PnP dispatches yet. Switch to the "New Dispatch" tab to process a weekly order.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action tab: New Dispatch */}
      {tab === "new" && <>
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s.num === step
                  ? "bg-primary text-primary-foreground"
                  : s.num < step
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.num < step ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.num
              )}
            </div>
            <span className={s.num === step ? "font-medium text-slate-800" : "text-slate-400"}>
              {s.label}
            </span>
            {s.num < 5 && <div className="w-6 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          Step 1: Upload
         ════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              Upload PnP Order File
            </h2>
            <p className="text-sm text-slate-500">
              Upload the weekly PnP order spreadsheet (.xlsx, .xls, or .csv) with DC columns.
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
            onClick={() => document.getElementById("pnp-file-input")?.click()}
          >
            <input
              id="pnp-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div>
                <div className="text-green-700 font-medium">{file.name}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                </div>
              </div>
            ) : (
              <div>
                <div className="text-slate-600 font-medium">
                  Drop your PnP order file here, or click to browse
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  Accepts .xlsx, .xls, and .csv files
                </div>
              </div>
            )}
          </div>

          {/* Date and time inputs */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Week Ending Date
              </label>
              <input
                type="date"
                value={weekEndingDate}
                onChange={(e) => setWeekEndingDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Appointment Time
              </label>
              <input
                type="datetime-local"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {uploadMutation.isError && (
            <ErrorBox>{uploadMutation.error.message}</ErrorBox>
          )}

          <StickyActionBar>
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !weekEndingDate || uploadMutation.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload & Parse"}
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Step 2: Review Parsed Order
         ════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-border p-4 flex gap-6 text-sm">
            <div>
              <span className="font-medium text-green-700">{matchedCount}</span>{" "}
              <span className="text-slate-600">products matched</span>
            </div>
            <div>
              <span className="font-medium text-red-600">{unmatchedCount}</span>{" "}
              <span className="text-slate-600">unmatched</span>
            </div>
            <div>
              <span className="text-slate-500">Week ending: {weekEndingDate}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      PnP Product Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Matched SKU
                    </th>
                    {DC_CODES.map((dc) => (
                      <th key={dc} className="text-right px-3 py-3 font-medium text-slate-600">
                        <div>{dc}</div>
                        <div className="text-[10px] font-normal text-slate-400 truncate max-w-[100px]">
                          {PNP_DCS[dc].split("(")[0].trim()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedLines.map((line, idx) => {
                    const isMatched = line.matched || !!manualSkuOverrides[idx];
                    const effectiveSku = manualSkuOverrides[idx] ?? line.skuCode;

                    return (
                      <tr
                        key={idx}
                        className={isMatched ? "hover:bg-slate-50" : "bg-red-50"}
                      >
                        <td className="px-4 py-3">
                          {line.pnpProductName}
                        </td>
                        <td className="px-4 py-3">
                          {isMatched ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-green-100 text-green-700">
                              {effectiveSku}
                            </span>
                          ) : (
                            <select
                              value={manualSkuOverrides[idx] ?? ""}
                              onChange={(e) => {
                                setManualSkuOverrides((prev) => ({
                                  ...prev,
                                  [idx]: e.target.value,
                                }));
                              }}
                              className="px-2 py-1 border border-red-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">-- Select SKU --</option>
                              {productList?.map((p) => (
                                <option key={p.skuCode} value={p.skuCode}>
                                  {p.skuCode} — {p.productName}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {DC_CODES.map((dc) => (
                          <td key={dc} className="text-right px-3 py-3 font-mono text-xs">
                            {line.dcQuantities[dc] > 0 ? (
                              <span className="font-medium">{line.dcQuantities[dc]}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {parsedLines.length === 0 && (
                    <tr>
                      <td colSpan={2 + DC_CODES.length} className="px-4 py-8 text-center text-slate-500">
                        No products parsed from the file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {createMutation.isError && (
            <ErrorBox>{createMutation.error.message}</ErrorBox>
          )}

          <StickyActionBar>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || matchedCount === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? "Creating..." : "Confirm & Create Order"}
            </button>
            <button
              onClick={() => {
                setStep(1);
                setParsedLines([]);
                uploadMutation.reset();
              }}
              disabled={createMutation.isPending}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Step 3: Stock Check
         ════════════════════════════════════════════════════════════ */}
      {step === 3 && createdOrder && (
        <div className="space-y-4">
          {/* Shortfall summary */}
          {shortfallLines.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              <span className="font-semibold">{shortfallLines.length}</span> product line(s) have shortfalls at 8/8. Review below.
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              All stock available at 8/8. No shortfalls.
            </div>
          )}

          {/* Stock grid: rows=products, columns=DCs */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Available (8/8)</th>
                    {DC_CODES.map((dc) => (
                      <th key={dc} className="text-center px-3 py-3 font-medium text-slate-600">
                        {dc}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total Ordered</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Shortfall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    // Group lines by SKU
                    const bySkuMap = new Map<string, OrderLine[]>();
                    for (const line of createdOrder.lines) {
                      const existing = bySkuMap.get(line.skuCode) ?? [];
                      existing.push(line);
                      bySkuMap.set(line.skuCode, existing);
                    }

                    const dcTotals: Record<string, number> = {};
                    DC_CODES.forEach((dc) => (dcTotals[dc] = 0));
                    let grandTotal = 0;
                    let grandShortfall = 0;

                    const rows = [...bySkuMap.entries()].map(([sku, skuLines]) => {
                      const available = createdOrder.stockCheck[sku]?.availableCases ?? 0;
                      const dcCases: Record<string, number> = {};
                      let totalOrdered = 0;
                      let totalShortfall = 0;

                      for (const dc of DC_CODES) {
                        const dcLine = skuLines.find((l) => l.dcCode === dc);
                        dcCases[dc] = dcLine?.orderedCases ?? 0;
                        dcTotals[dc] += dcCases[dc];
                        totalOrdered += dcCases[dc];
                      }

                      totalShortfall = Math.max(0, totalOrdered - available);
                      grandTotal += totalOrdered;
                      grandShortfall += totalShortfall;

                      return { sku, available, dcCases, totalOrdered, totalShortfall };
                    });

                    return (
                      <>
                        {rows.map((row) => (
                          <tr
                            key={row.sku}
                            className={row.totalShortfall > 0 ? "bg-red-50" : "hover:bg-slate-50"}
                          >
                            <td className="px-4 py-3 font-mono text-xs font-medium">{row.sku}</td>
                            <td className="px-4 py-3 font-mono text-xs">{row.available}</td>
                            {DC_CODES.map((dc) => (
                              <td key={dc} className="text-center px-3 py-3 font-mono text-xs">
                                {row.dcCases[dc] > 0 ? row.dcCases[dc] : <span className="text-slate-300">-</span>}
                              </td>
                            ))}
                            <td className="text-right px-4 py-3 font-mono text-xs font-medium">
                              {row.totalOrdered}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-xs">
                              {row.totalShortfall > 0 ? (
                                <span className="text-red-600 font-semibold">{row.totalShortfall}</span>
                              ) : (
                                <span className="text-green-600">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="bg-slate-100 font-medium">
                          <td className="px-4 py-3 text-xs">TOTALS</td>
                          <td className="px-4 py-3"></td>
                          {DC_CODES.map((dc) => (
                            <td key={dc} className="text-center px-3 py-3 font-mono text-xs">
                              {dcTotals[dc]}
                            </td>
                          ))}
                          <td className="text-right px-4 py-3 font-mono text-xs">{grandTotal}</td>
                          <td className="text-right px-4 py-3 font-mono text-xs">
                            {grandShortfall > 0 ? (
                              <span className="text-red-600">{grandShortfall}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <StickyActionBar>
            <button
              onClick={() => fetchDispatchInstruction(createdOrder.order.id)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Proceed with Available Stock
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Back to Edit
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Step 4: Dispatch Instruction
         ════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Dispatch Instruction Email</h2>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                readOnly
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-slate-50"
              />
            </div>

            {/* Xero invoice ref */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Xero Invoice Reference
              </label>
              <input
                type="text"
                value={xeroInvoiceRef}
                onChange={(e) => setXeroInvoiceRef(e.target.value)}
                placeholder="e.g. INV-0012345"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Email body */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Body</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={24}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {dispatchMutation.isError && (
            <ErrorBox>{dispatchMutation.error.message}</ErrorBox>
          )}

          <StickyActionBar>
            <button
              onClick={handleCopy}
              className={`px-6 py-2 rounded-lg text-sm font-medium ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dispatchMutation.isPending ? "Dispatching..." : "Approve & Mark Dispatched"}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={dispatchMutation.isPending}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Step 5: Post-Dispatch
         ════════════════════════════════════════════════════════════ */}
      {step === 5 && dispatchResult && (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-slate-800">
            PnP Order Dispatched
          </h2>

          <p className="text-slate-600">
            Successfully created{" "}
            <span className="font-semibold">{dispatchResult.transactionsCreated}</span> stock
            transactions (PNP_OUT) at 8/8 location.
          </p>

          <p className="text-sm text-slate-500">
            Order #{dispatchResult.orderId} — Week ending {weekEndingDate}
          </p>

          {/* Transfer alerts */}
          {dispatchResult.lowStockAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mt-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">
                Low Stock Alerts Raised
              </h3>
              <p className="text-xs text-amber-700 mb-2">
                The following products are now below their reorder point at 8/8. Consider a THH-to-8/8 transfer:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {dispatchResult.lowStockAlerts.map((sku) => (
                  <li key={sku} className="font-mono text-xs">{sku}</li>
                ))}
              </ul>
            </div>
          )}

          {dispatchResult.lowStockAlerts.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 mt-4">
              No low-stock alerts raised. All affected 8/8 products remain above reorder points.
            </div>
          )}

          <div className="pt-4 flex gap-3 justify-center">
            <Link
              to="/"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setWeekEndingDate("");
                setAppointmentTime("");
                setParsedLines([]);
                setCreatedOrder(null);
                setEmailBody("");
                setEmailSubject("");
                setXeroInvoiceRef("");
                setDispatchResult(null);
                uploadMutation.reset();
                createMutation.reset();
                dispatchMutation.reset();
              }}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Process Another Week
            </button>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

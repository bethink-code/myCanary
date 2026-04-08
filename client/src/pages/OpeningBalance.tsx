import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { formatDateShort } from "../lib/formatters";
import { invalidateStockData } from "../lib/invalidation";
import { Link, useNavigate } from "react-router-dom";
import LoadingOverlay from "../components/LoadingOverlay";
import StickyActionBar from "../components/StickyActionBar";
import ErrorBox from "../components/ErrorBox";

interface ParsedRow {
  sheetCode: string;
  productName: string;
  size: string;
  skuCode: string | null;
  totalStock: number;
  thhStock: number;
  eightEightStock: number;
  reorderPoint: number | null;
  matched: boolean;
  matchIssue?: string;
}

interface PreviewSummary {
  matchedCount: number;
  unmatchedCount: number;
  totalThhUnits: number;
  totalEeUnits: number;
  totalRows: number;
}

export default function OpeningBalance() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<"sheets" | "file">("sheets");
  const [file, setFile] = useState<File | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [commitCount, setCommitCount] = useState(0);
  const [source, setSource] = useState("");

  // Pull from Google Sheets
  const sheetPullMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/stock-in/opening-balance/pull-sheet");
    },
    onSuccess: (data: any) => {
      setRows(data.rows);
      setSummary(data.summary);
      setSource(data.source ?? "Google Sheets");
      setStep(2);
    },
  });

  // Upload file
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please select the Animal Farm file");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/stock-in/opening-balance/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setSummary(data.summary);
      setSource("File upload");
      setStep(2);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("/api/stock-in/opening-balance/commit", {
        method: "POST",
        body: JSON.stringify({
          rows: rows.filter((r) => r.matched),
          asOfDate,
        }),
      });
      return result;
    },
    onSuccess: (data: any) => {
      setCommitCount(data.created);
      invalidateStockData(qc);
      setStep(3);
    },
  });

  const { data: ledgerData } = useQuery<{ ledgerStartDate: string | null; hasOpeningBalance: boolean }>({
    queryKey: ["ledger-date"],
    queryFn: () => apiRequest("/api/xero/import/ledger-date"),
  });

  return (
    <div className="space-y-6">
      {sheetPullMutation.isPending && (
        <LoadingOverlay
          message="Pulling live data from Google Sheets..."
          submessage="Reading Animal Farm spreadsheet via Google Sheets API."
        />
      )}
      {previewMutation.isPending && (
        <LoadingOverlay message="Parsing Animal Farm spreadsheet..." />
      )}
      {commitMutation.isPending && (
        <LoadingOverlay
          message="Creating Stock In: Opening Balance transactions..."
          submessage="This may take a moment."
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Stock In: Opening Balances
          </h1>
          <p className="text-sm text-green-600 mt-1">
            Import current stock levels from the Animal Farm spreadsheet.
          </p>
        </div>
        <Link
          to="/stock"
          className="px-4 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          Back to Stock Levels
        </Link>
      </div>

      {/* Current status */}
      {ledgerData?.hasOpeningBalance && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800">
          Opening balance imported as of <strong>{formatDateShort(ledgerData.ledgerStartDate)}</strong>.
          Re-importing will replace the existing data.
        </div>
      )}

      {/* Step 1: Source selection */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setImportMode("sheets")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                importMode === "sheets"
                  ? "bg-green-600 text-white"
                  : "bg-white border border-border text-slate-600 hover:bg-slate-50"
              }`}
            >
              Pull from Google Sheets (live)
            </button>
            <button
              onClick={() => setImportMode("file")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                importMode === "file"
                  ? "bg-green-600 text-white"
                  : "bg-white border border-border text-slate-600 hover:bg-slate-50"
              }`}
            >
              Upload Excel File
            </button>
          </div>

          {/* Google Sheets mode */}
          {importMode === "sheets" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Pull Live from Animal Farm Google Sheet
                </h2>
                <p className="text-sm text-slate-500">
                  Reads the Summary master sheet directly from Google Drive. This is the live source of truth.
                </p>
              </div>

              <div className="max-w-xs">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stock As-Of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-slate-400 mt-1">
                  The date these stock levels represent.
                </p>
              </div>

              {sheetPullMutation.isError && (
                <ErrorBox>
                  {(sheetPullMutation.error as any)?.message ?? "Failed to pull from Google Sheets"}
                  {(sheetPullMutation.error as any)?.message?.includes("sign out") && (
                    <p className="mt-2">
                      <a href="/auth/logout" className="text-primary underline">Sign out</a> and sign in again to grant Google Sheets permission.
                    </p>
                  )}
                </ErrorBox>
              )}

              <StickyActionBar>
                <button
                  onClick={() => sheetPullMutation.mutate()}
                  disabled={sheetPullMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Pull Stock Levels from Google Sheets
                </button>
              </StickyActionBar>
            </div>
          )}

          {/* File upload mode */}
          {importMode === "file" && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Upload Animal Farm Spreadsheet
                </h2>
                <p className="text-sm text-slate-500">
                  Upload the Animal Farm Excel file. The system will read the Summary
                  master sheet and map products to the system SKU codes.
                </p>
              </div>

              <div
                onClick={() => document.getElementById("ob-file-input")?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  file
                    ? "border-green-300 bg-green-50"
                    : "border-slate-300 hover:border-slate-400"
                }`}
              >
                <input
                  id="ob-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <p className="text-green-700 font-medium">{file.name}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — Click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-600 font-medium">
                      Click to select the Animal Farm Excel file
                    </p>
                <p className="text-sm text-slate-400 mt-1">
                  Accepts .xlsx and .xls
                </p>
              </div>
            )}
          </div>

              <div className="max-w-xs">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stock As-Of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-slate-400 mt-1">
                  The date these stock levels represent.
                </p>
              </div>

              {previewMutation.isError && (
                <ErrorBox>{previewMutation.error.message}</ErrorBox>
              )}

              <StickyActionBar>
                <button
                  onClick={() => previewMutation.mutate()}
                  disabled={!file || previewMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Parse & Preview
                </button>
              </StickyActionBar>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && summary && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="font-bold text-green-700">{summary.matchedCount}</span>{" "}
                <span className="text-slate-600">products matched</span>
              </div>
              <div>
                <span className="font-bold text-red-600">{summary.unmatchedCount}</span>{" "}
                <span className="text-slate-600">unmatched</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">
                  {summary.totalThhUnits.toLocaleString()}
                </span>{" "}
                <span className="text-slate-600">THH units</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">
                  {summary.totalEeUnits.toLocaleString()}
                </span>{" "}
                <span className="text-slate-600">8/8 units</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              As of {asOfDate}. Reorder points from the spreadsheet will also be
              imported.
            </p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Sheet Code
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Product
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Mapped SKU
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      THH On Hand
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      8/8 On Hand
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Reorder Point
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.sheetCode}-${idx}`}
                      className={row.matched ? "hover:bg-slate-50" : "bg-red-50"}
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.sheetCode}
                      </td>
                      <td className="px-4 py-3">
                        {row.productName}
                        <span className="text-slate-400 ml-1 text-xs">
                          {row.size}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.skuCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.thhStock}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.eightEightStock}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.reorderPoint ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.matched ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Matched
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                            title={row.matchIssue}
                          >
                            Unmatched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {commitMutation.isError && (
            <ErrorBox>
              {(commitMutation.error as any)?.message ?? "Import failed"}
            </ErrorBox>
          )}

          <StickyActionBar>
            <button
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending || summary.matchedCount === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Import {summary.matchedCount} Products as Opening Balance
            </button>
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-border text-slate-700 rounded-lg text-sm hover:bg-slate-50"
            >
              Back
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
          <div className="text-green-600 text-4xl">&#10003;</div>
          <h2 className="text-xl font-bold text-slate-900">
            Opening Balances Imported
          </h2>
          <p className="text-slate-600">
            Created {commitCount} Stock In transactions as of {asOfDate}.
            <br />
            Stock levels are now visible across the system.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              to="/stock"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              View Stock Levels
            </Link>
            <Link
              to="/"
              className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

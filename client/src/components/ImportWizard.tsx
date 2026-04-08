import { useState, ReactNode } from "react";
import PageTabs from "./PageTabs";
import StickyActionBar from "./StickyActionBar";
import ErrorBox from "./ErrorBox";
import LoadingOverlay from "./LoadingOverlay";

/**
 * Shared import wizard framework.
 * Steps: Source (fetch/upload) → Clean & Verify → Confirm → Done
 *
 * Each import type provides:
 * - renderCleanStep: UI for reviewing/editing parsed items
 * - onFetch/onUpload: async functions that return parsed data
 * - onCommit: async function that imports the cleaned data
 */

export type WizardStep = "source" | "clean" | "done";

export interface ImportWizardProps<T> {
  /** Page title */
  title: string;
  /** Subtitle description */
  description: string;

  /** Async: fetch from Google Sheets */
  onFetch?: () => Promise<T[]>;
  fetchLabel?: string;
  fetchLoadingMessage?: string;

  /** Async: parse uploaded file */
  onUpload?: (file: File) => Promise<T[]>;
  uploadLabel?: string;

  /** Render the clean/verify step — user reviews, edits, and accepts items */
  renderCleanStep: (items: T[], setItems: (items: T[]) => void) => ReactNode;

  /** Count of items that will be imported (after user cleanup) */
  getAcceptCount: (items: T[]) => number;

  /** Async: commit the cleaned items */
  onCommit: (items: T[]) => Promise<{ imported: number }>;
  commitLabel?: string;

  /** Render after successful import */
  renderDoneStep?: (count: number) => ReactNode;
}

export default function ImportWizard<T>({
  title,
  description,
  onFetch,
  fetchLabel = "Pull from Google Sheets",
  fetchLoadingMessage = "Pulling data from Google Sheets...",
  onUpload,
  uploadLabel = "Upload & Preview",
  renderCleanStep,
  getAcceptCount,
  onCommit,
  commitLabel,
  renderDoneStep,
}: ImportWizardProps<T>) {
  const [step, setStep] = useState<WizardStep>("source");
  const [sourceMode, setSourceMode] = useState<"fetch" | "upload">("fetch");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!onFetch) return;
    setFetching(true);
    setError(null);
    try {
      const data = await onFetch();
      setItems(data);
      setStep("clean");
    } catch (e: any) {
      setError(e.message ?? "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const handleUpload = async () => {
    if (!onUpload || !file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await onUpload(file);
      setItems(data);
      setStep("clean");
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const result = await onCommit(items);
      setImportedCount(result.imported);
      setStep("done");
    } catch (e: any) {
      setError(e.message ?? "Import failed");
    } finally {
      setCommitting(false);
    }
  };

  const acceptCount = getAcceptCount(items);
  const defaultCommitLabel = commitLabel ?? `Import ${acceptCount} Items`;

  return (
    <div className="space-y-6">
      {fetching && <LoadingOverlay message={fetchLoadingMessage} />}
      {uploading && <LoadingOverlay message="Parsing file..." />}
      {committing && <LoadingOverlay message="Importing..." submessage="Creating records from verified data." />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <StepBadge label="1. Source" active={step === "source"} done={step === "clean" || step === "done"} />
        <span>→</span>
        <StepBadge label="2. Clean & Verify" active={step === "clean"} done={step === "done"} />
        <span>→</span>
        <StepBadge label="3. Done" active={step === "done"} done={false} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {/* Step 1: Source */}
      {step === "source" && (
        <div className="space-y-4">
          {onFetch && onUpload && (
            <PageTabs
              tabs={[
                { id: "fetch", label: "Fetch" },
                { id: "upload", label: "Upload" },
              ]}
              activeTab={sourceMode}
              onChange={(id) => setSourceMode(id as "fetch" | "upload")}
            />
          )}

          {sourceMode === "fetch" && onFetch && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Pull live data from the Animal Farm Google Sheet. You'll review and clean the data before anything is imported.
              </p>
              <StickyActionBar>
                <button
                  onClick={handleFetch}
                  disabled={fetching}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetching ? "Pulling..." : fetchLabel}
                </button>
              </StickyActionBar>
            </div>
          )}

          {(sourceMode === "upload" || !onFetch) && onUpload && (
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && /\.xlsx?$/.test(f.name)) setFile(f); }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" : file ? "border-green-300 bg-green-50" : "border-slate-300 hover:border-slate-400"
                }`}
                onClick={() => document.getElementById("import-wizard-file")?.click()}
              >
                <input id="import-wizard-file" type="file" accept=".xlsx,.xls" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} className="hidden" />
                {file ? (
                  <div>
                    <div className="text-green-700 font-medium">{file.name}</div>
                    <div className="text-sm text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB — Click or drop to replace</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-slate-600 font-medium">Drop your Excel file here, or click to browse</div>
                    <div className="text-sm text-slate-400 mt-1">Accepts .xlsx and .xls files</div>
                  </div>
                )}
              </div>
              <StickyActionBar>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Parsing..." : uploadLabel}
                </button>
              </StickyActionBar>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Clean & Verify */}
      {step === "clean" && (
        <div className="space-y-4">
          {renderCleanStep(items, setItems)}

          <StickyActionBar>
            <button
              onClick={handleCommit}
              disabled={committing || acceptCount === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? "Importing..." : defaultCommitLabel}
            </button>
            <button
              onClick={() => { setStep("source"); setItems([]); setError(null); }}
              disabled={committing}
              className="px-6 py-2 bg-white border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && (
        renderDoneStep ? renderDoneStep(importedCount) : (
          <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
            <div className="text-green-600 text-4xl">&#10003;</div>
            <h2 className="text-xl font-bold text-slate-900">Import Complete</h2>
            <p className="text-slate-600">
              Successfully imported <strong>{importedCount}</strong> items.
            </p>
            <button
              onClick={() => { setStep("source"); setItems([]); setImportedCount(0); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Done
            </button>
          </div>
        )
      )}
    </div>
  );
}

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
      active ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
    }`}>
      {done ? "✓ " : ""}{label}
    </span>
  );
}

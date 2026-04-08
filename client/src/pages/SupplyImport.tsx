import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import ImportWizard from "../components/ImportWizard";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParsedSupplyRow {
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING";
  subcategory: string | null;
  totalStock: number;
  reorderPoint: number | null;
  supplier: string | null;
  price: string | null;
  moq: string | null;
  leadTime: string | null;
  matchStatus: "MATCHED" | "NEW";
}

/** Local wrapper that adds a UI-only `keep` flag and allows name/category edits */
interface SupplyRowWithKeep extends ParsedSupplyRow {
  keep: boolean;
}

/* ------------------------------------------------------------------ */
/*  Noise detection                                                    */
/* ------------------------------------------------------------------ */

const SECTION_HEADERS = [
  "SPRAY:",
  "SHAMPOO:",
  "CONTAINERS:",
  "LABELS:",
  "CASES:",
  "Ordered by us",
  "Packaging Descriptions",
];

const NOTE_PHRASES = [
  "are already printed",
  "not needed",
  "No spoon",
  "same as above",
  "available from",
];

function looksLikeNoise(row: ParsedSupplyRow): boolean {
  const name = row.name.trim();

  // Section header patterns
  if (SECTION_HEADERS.some((h) => name.startsWith(h) || name === h.replace(":", ""))) {
    return true;
  }

  // Description / note patterns
  const lower = name.toLowerCase();
  if (NOTE_PHRASES.some((p) => lower.includes(p.toLowerCase()))) {
    return true;
  }

  // Very short or very long name with no stock and no supplier
  if ((name.length < 5 || name.length > 200) && !row.totalStock && !row.supplier) {
    return true;
  }

  return false;
}

function addKeepFlags(rows: ParsedSupplyRow[]): SupplyRowWithKeep[] {
  return rows.map((r) => ({
    ...r,
    keep: !looksLikeNoise(r),
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SupplyImport() {
  const qc = useQueryClient();

  /* --- wizard callbacks ------------------------------------------- */

  const handleFetch = async (): Promise<SupplyRowWithKeep[]> => {
    const data = await apiRequest("/api/supplies/import/pull-sheet");
    return addKeepFlags(data.rows as ParsedSupplyRow[]);
  };

  const handleUpload = async (file: File): Promise<SupplyRowWithKeep[]> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/supplies/import/preview", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(body.message ?? "Upload failed");
    }
    const data = await res.json();
    return addKeepFlags(data.rows as ParsedSupplyRow[]);
  };

  const handleCommit = async (
    items: SupplyRowWithKeep[],
  ): Promise<{ imported: number }> => {
    const accepted = items
      .filter((r) => r.keep)
      .map(({ keep, ...rest }) => rest as ParsedSupplyRow);

    const result = await apiRequest("/api/supplies/import/commit", {
      method: "POST",
      body: JSON.stringify({ items: accepted }),
    });

    invalidateStockData(qc);
    return result as { imported: number };
  };

  const getAcceptCount = (items: SupplyRowWithKeep[]) =>
    items.filter((r) => r.keep).length;

  /* --- render ----------------------------------------------------- */

  return (
    <ImportWizard<SupplyRowWithKeep>
      title="Stock In: Supply Import"
      description="Import supplies from Google Sheets or an uploaded file. Review and clean items before committing."
      onFetch={handleFetch}
      fetchLabel="Pull from Google Sheets"
      fetchLoadingMessage="Pulling supply data from Google Sheets..."
      onUpload={handleUpload}
      uploadLabel="Upload & Preview"
      renderCleanStep={(items, setItems) => (
        <CleanStep items={items} setItems={setItems} />
      )}
      getAcceptCount={getAcceptCount}
      onCommit={handleCommit}
      renderDoneStep={(count) => (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-4">
          <div className="text-green-600 text-4xl">&#10003;</div>
          <h2 className="text-xl font-bold text-slate-900">Import Complete</h2>
          <p className="text-slate-600">
            Successfully imported <strong>{count}</strong> supply items.
          </p>
          <Link
            to="/supplies"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Go to Supplies
          </Link>
        </div>
      )}
    />
  );
}

/* ================================================================== */
/*  Clean Step                                                         */
/* ================================================================== */

function CleanStep({
  items,
  setItems,
}: {
  items: SupplyRowWithKeep[];
  setItems: (items: SupplyRowWithKeep[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const keepCount = items.filter((r) => r.keep).length;
  const skipCount = items.length - keepCount;
  const newCount = items.filter((r) => r.keep && r.matchStatus === "NEW").length;
  const matchedCount = items.filter((r) => r.keep && r.matchStatus === "MATCHED").length;

  const toggleKeep = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], keep: !next[idx].keep };
    setItems(next);
  };

  const toggleAll = (keep: boolean) => {
    setItems(items.map((r) => ({ ...r, keep })));
  };

  const toggleCategory = (idx: number) => {
    const next = [...items];
    next[idx] = {
      ...next[idx],
      category: next[idx].category === "RAW_MATERIAL" ? "PACKAGING" : "RAW_MATERIAL",
    };
    setItems(next);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditName(items[idx].name);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== items[editingIdx].name) {
      const next = [...items];
      next[editingIdx] = { ...next[editingIdx], name: trimmed };
      setItems(next);
    }
    setEditingIdx(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditName("");
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="font-semibold text-green-700">{keepCount}</span>{" "}
          <span className="text-slate-600">items to import</span>
        </div>
        <div>
          <span className="font-semibold text-slate-400">{skipCount}</span>{" "}
          <span className="text-slate-600">skipped</span>
        </div>
        <div className="border-l border-border pl-6">
          <span className="font-semibold text-green-600">{matchedCount}</span>{" "}
          <span className="text-slate-600">matched</span>
        </div>
        <div>
          <span className="font-semibold text-blue-600">{newCount}</span>{" "}
          <span className="text-slate-600">new</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => toggleAll(true)}
            className="px-3 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
          >
            Keep All
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="px-3 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Skip All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-10 px-4 py-3 text-center">
                  <span className="sr-only">Keep</span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Subcategory
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Stock
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Reorder Pt
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Supplier
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">
                  Match
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((row, idx) => {
                const isNoise = !row.keep;
                const isEditing = editingIdx === idx;

                return (
                  <tr
                    key={idx}
                    className={
                      isNoise
                        ? "bg-slate-50 text-slate-400"
                        : "hover:bg-slate-50"
                    }
                  >
                    {/* Keep checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.keep}
                        onChange={() => toggleKeep(idx)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>

                    {/* Name (editable) */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                            className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            onClick={commitEdit}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-slate-400 hover:text-slate-600 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => startEdit(idx)}
                          className={`cursor-pointer hover:underline ${
                            isNoise ? "line-through" : ""
                          }`}
                          title="Click to edit name"
                        >
                          {row.name}
                        </span>
                      )}
                    </td>

                    {/* Category badge (clickable to toggle) */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCategory(idx)}
                        title="Click to toggle category"
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          row.category === "RAW_MATERIAL"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.category === "RAW_MATERIAL" ? "Raw Material" : "Packaging"}
                      </button>
                    </td>

                    {/* Subcategory */}
                    <td className="px-4 py-3 text-slate-600">
                      {row.subcategory ?? "—"}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3 text-right font-mono">
                      {row.totalStock}
                    </td>

                    {/* Reorder point */}
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {row.reorderPoint ?? "—"}
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3 text-slate-600">
                      {row.supplier ?? "—"}
                    </td>

                    {/* Match status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.matchStatus === "MATCHED"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.matchStatus === "MATCHED" ? "Matched" : "New"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No rows parsed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
          {items.length} rows parsed — click a name to edit, click a category badge to toggle
        </div>
      </div>
    </div>
  );
}

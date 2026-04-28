import { useState } from "react";

interface SupplyOption {
  id: number;
  name: string;
  unitOfMeasure: string | null;
}

interface ProductOption {
  skuCode: string;
  productName: string;
}

interface ExistingMapping {
  id?: number;
  supplyId: number;
  skuCode: string;
  quantityPerUnit: number;
  notes: string | null;
}

interface Props {
  /** Pre-filled mapping (edit) or partial (add). null = full add from scratch. */
  mapping: ExistingMapping | { supplyId?: number; skuCode?: string } | null;
  supplies: SupplyOption[];
  products: ProductOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: { supplyId: number; skuCode: string; quantityPerUnit: number; notes: string | null }) => void;
  onDelete?: () => void;
}

export default function BomEditModal({ mapping, supplies, products, saving, onClose, onSave, onDelete }: Props) {
  const isExisting = !!(mapping && "id" in mapping && mapping.id);

  const [supplyId, setSupplyId] = useState<number | "">(mapping?.supplyId ?? "");
  const [skuCode, setSkuCode] = useState<string>(mapping?.skuCode ?? "");
  const [qty, setQty] = useState<string>(
    mapping && "quantityPerUnit" in mapping && mapping.quantityPerUnit != null
      ? String(mapping.quantityPerUnit)
      : "",
  );
  const [notes, setNotes] = useState<string>(
    mapping && "notes" in mapping && mapping.notes ? mapping.notes : "",
  );

  const valid = supplyId !== "" && skuCode.trim() !== "" && Number(qty) > 0;
  const supply = supplies.find((s) => s.id === supplyId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          {isExisting ? "Edit BOM mapping" : "Add BOM mapping"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supply</label>
            <select
              value={supplyId}
              onChange={(e) => setSupplyId(e.target.value ? Number(e.target.value) : "")}
              disabled={isExisting}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm disabled:bg-slate-50"
            >
              <option value="">— Select supply —</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.unitOfMeasure ? ` (${s.unitOfMeasure})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product (SKU)</label>
            <select
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              disabled={isExisting}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm disabled:bg-slate-50 font-mono"
            >
              <option value="">— Select SKU —</option>
              {products.map((p) => (
                <option key={p.skuCode} value={p.skuCode}>
                  {p.skuCode} — {p.productName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantity per unit{supply?.unitOfMeasure ? ` (${supply.unitOfMeasure} per finished unit)` : ""}
            </label>
            <input
              type="number"
              step="0.0001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 0.0125"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex gap-3">
            <button
              disabled={!valid || saving}
              onClick={() =>
                onSave({
                  supplyId: Number(supplyId),
                  skuCode: skuCode.trim(),
                  quantityPerUnit: Number(qty),
                  notes: notes.trim() || null,
                })
              }
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : isExisting ? "Save changes" : "Add mapping"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
          {isExisting && onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

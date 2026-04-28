import { useState } from "react";

interface SupplyForm {
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING";
  subcategory: string;
  unitOfMeasure: string;
  supplier: string;
  supplierContact: string;
  priceDescription: string;
  moq: string;
  leadTime: string;
  reorderPoint: number | "";
  moqStructured: number | "";
  moqUnit: string;
  caseRoundingRequired: boolean;
  unitsPerCase: number | "";
  notes: string;
  isActive: boolean;
}

interface ExistingSupply {
  id?: number;
  name?: string;
  category?: "RAW_MATERIAL" | "PACKAGING";
  subcategory?: string | null;
  unitOfMeasure?: string | null;
  supplier?: string | null;
  supplierContact?: string | null;
  priceDescription?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  reorderPoint?: number | null;
  moqStructured?: number | null;
  moqUnit?: string | null;
  caseRoundingRequired?: boolean;
  unitsPerCase?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

interface Props {
  supply: ExistingSupply | null; // null = create new
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}

function init(supply: ExistingSupply | null): SupplyForm {
  return {
    name: supply?.name ?? "",
    category: (supply?.category as SupplyForm["category"]) ?? "RAW_MATERIAL",
    subcategory: supply?.subcategory ?? "",
    unitOfMeasure: supply?.unitOfMeasure ?? "",
    supplier: supply?.supplier ?? "",
    supplierContact: supply?.supplierContact ?? "",
    priceDescription: supply?.priceDescription ?? "",
    moq: supply?.moq ?? "",
    leadTime: supply?.leadTime ?? "",
    reorderPoint: supply?.reorderPoint ?? "",
    moqStructured: supply?.moqStructured ?? "",
    moqUnit: supply?.moqUnit ?? "",
    caseRoundingRequired: supply?.caseRoundingRequired ?? false,
    unitsPerCase: supply?.unitsPerCase ?? "",
    notes: supply?.notes ?? "",
    isActive: supply?.isActive ?? true,
  };
}

export default function SupplyEditModal({ supply, saving, onClose, onSave }: Props) {
  const isExisting = !!supply?.id;
  const [form, setForm] = useState<SupplyForm>(init(supply));

  const valid = form.name.trim().length > 0 && (form.category === "RAW_MATERIAL" || form.category === "PACKAGING");

  function set<K extends keyof SupplyForm>(k: K, v: SupplyForm[K]) {
    setForm({ ...form, [k]: v });
  }

  function submit() {
    onSave({
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      unitOfMeasure: form.unitOfMeasure.trim() || null,
      supplier: form.supplier.trim() || null,
      supplierContact: form.supplierContact.trim() || null,
      priceDescription: form.priceDescription.trim() || null,
      moq: form.moq.trim() || null,
      leadTime: form.leadTime.trim() || null,
      reorderPoint: form.reorderPoint === "" ? null : Number(form.reorderPoint),
      moqStructured: form.moqStructured === "" ? null : Number(form.moqStructured),
      moqUnit: form.moqUnit.trim() || null,
      caseRoundingRequired: form.caseRoundingRequired,
      unitsPerCase: form.unitsPerCase === "" ? null : Number(form.unitsPerCase),
      notes: form.notes.trim() || null,
      ...(isExisting ? { isActive: form.isActive } : {}),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-900">
          {isExisting ? `Edit ${supply!.name}` : "New supply"}
        </h2>

        {/* Identity */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as SupplyForm["category"])}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="PACKAGING">Packaging</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory</label>
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
                placeholder="e.g. Bulk tablets, Labels"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit of measure</label>
              <input
                type="text"
                value={form.unitOfMeasure}
                onChange={(e) => set("unitOfMeasure", e.target.value)}
                placeholder="e.g. kg, units"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Supplier */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Supplier</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier name</label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) => set("supplier", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                <input
                  type="text"
                  value={form.supplierContact}
                  onChange={(e) => set("supplierContact", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (free text)</label>
              <input
                type="text"
                value={form.priceDescription}
                onChange={(e) => set("priceDescription", e.target.value)}
                placeholder="e.g. R110 for 10kg, USD 0.66 per unit"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead time (free text)</label>
              <input
                type="text"
                value={form.leadTime}
                onChange={(e) => set("leadTime", e.target.value)}
                placeholder="e.g. 2 weeks, 3 months"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Stock planning */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stock planning</div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder point</label>
              <input
                type="number"
                value={form.reorderPoint}
                onChange={(e) => set("reorderPoint", e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="When stock falls to or below this value, flag for reorder"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* MOQ rules (the F3 structured fields) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">MOQ rules (used by PO drafting)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Min order qty (structured)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.moqStructured}
                  onChange={(e) => set("moqStructured", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MOQ unit (override)</label>
                <input
                  type="text"
                  value={form.moqUnit}
                  onChange={(e) => set("moqUnit", e.target.value)}
                  placeholder="defaults to unit of measure"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Units per case</label>
                <input
                  type="number"
                  value={form.unitsPerCase}
                  onChange={(e) => set("unitsPerCase", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="for case-rounding"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.caseRoundingRequired}
                    onChange={(e) => set("caseRoundingRequired", e.target.checked)}
                  />
                  Round PO qty up to nearest case
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                MOQ notes (free text — colour for the rules above)
              </label>
              <input
                type="text"
                value={form.moq}
                onChange={(e) => set("moq", e.target.value)}
                placeholder="e.g. 10kg, ships in cases of 12"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Other */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            {isExisting && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set("isActive", e.target.checked)}
                />
                Active
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            disabled={!valid || saving}
            onClick={submit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : isExisting ? "Save changes" : "Create supply"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

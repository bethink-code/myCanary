import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "../lib/queryClient";

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.has("xero") || params.get("tab") === "system") return "system";
  return params.get("tab") ?? "products";
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const tabs = [
    { id: "products", label: "Products & SKUs" },
    { id: "manufacturers", label: "Manufacturers" },
    { id: "system", label: "System Settings" },
  ];

  // Imports/setup that previously lived under Tools — link to their own routes.
  const importTabs = [
    { to: "/settings/opening-balance", label: "Opening Balance Import" },
    { to: "/settings/supply-import", label: "Supply Import" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {importTabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "products" && <ProductsTab />}
      {activeTab === "manufacturers" && <ManufacturersTab />}
      {activeTab === "system" && <SystemSettingsTab />}
    </div>
  );
}

function ProductsTab() {
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const qc = useQueryClient();

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["products", showArchived],
    queryFn: () =>
      apiRequest(`/api/products${showArchived ? "?active=false" : ""}`),
  });

  const { data: manufacturers = [] } = useQuery<any[]>({
    queryKey: ["manufacturers"],
    queryFn: () => apiRequest("/api/manufacturers"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { skuCode: string; updates: any }) =>
      apiRequest(`/api/products/${data.skuCode}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditingProduct(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setAddingProduct(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (data: { skuCode: string; isActive: boolean }) =>
      apiRequest(`/api/products/${data.skuCode}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: data.isActive }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function handleArchiveToggle(p: any) {
    const archiving = p.isActive;
    const confirmMsg = archiving
      ? `Archive ${p.skuCode} — ${p.productName}?\n\nArchived products are hidden from stock, snapshots, and calculations but all history is preserved. You can restore them later.`
      : `Restore ${p.skuCode} — ${p.productName}?\n\nIt will reappear in stock views and calculations.`;
    if (!window.confirm(confirmMsg)) return;
    archiveMutation.mutate({ skuCode: p.skuCode, isActive: !archiving });
  }

  const filtered = products.filter((p: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.skuCode.toLowerCase().includes(term) ||
      p.productName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show archived
        </label>
        <div className="flex-1" />
        <button
          onClick={() => setAddingProduct(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Add product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Brand</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Manufacturer</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Units/Case</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">RP Override</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p: any) => (
                <tr
                  key={p.skuCode}
                  className={`hover:bg-slate-50 ${!p.isActive ? "text-slate-400" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{p.skuCode}</td>
                  <td className="px-4 py-3">
                    {p.productName}
                    {!p.isActive && (
                      <span className="ml-2 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.brand}</td>
                  <td className="px-4 py-3">{p.category.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    {p.manufacturerName ?? <span className="text-amber-600">TBC</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{p.unitsPerCase ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{p.reorderPointOverride ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditingProduct(p)}
                        className="text-primary hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(p)}
                        disabled={archiveMutation.isPending}
                        className="text-xs text-slate-500 hover:text-red-600 hover:underline disabled:opacity-50"
                      >
                        {p.isActive ? "Archive" : "Restore"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          manufacturers={manufacturers}
          onSave={(updates) =>
            updateMutation.mutate({ skuCode: editingProduct.skuCode, updates })
          }
          onClose={() => setEditingProduct(null)}
          saving={updateMutation.isPending}
        />
      )}

      {/* Add Modal */}
      {addingProduct && (
        <AddProductModal
          manufacturers={manufacturers}
          onSave={(payload) => createMutation.mutate(payload)}
          onClose={() => {
            setAddingProduct(false);
            createMutation.reset();
          }}
          saving={createMutation.isPending}
          error={createMutation.error as Error | null}
        />
      )}
    </div>
  );
}

function AddProductModal({
  manufacturers,
  onSave,
  onClose,
  saving,
  error,
}: {
  manufacturers: any[];
  onSave: (payload: any) => void;
  onClose: () => void;
  saving: boolean;
  error: Error | null;
}) {
  const [form, setForm] = useState({
    skuCode: "",
    productName: "",
    brand: "",
    category: "",
    manufacturerId: "",
    primaryStockLocation: "THH",
    packSizeG: "",
    unitsPerCase: "",
    reorderPointOverride: "",
    xeroItemCode: "",
    apBrandEquivalent: "",
    notes: "",
  });

  const canSave =
    form.skuCode.trim() && form.productName.trim() && form.brand.trim() && form.category.trim();

  function handleSave() {
    onSave({
      skuCode: form.skuCode.trim(),
      productName: form.productName.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      manufacturerId: form.manufacturerId ? Number(form.manufacturerId) : null,
      primaryStockLocation: form.primaryStockLocation || "THH",
      packSizeG: form.packSizeG ? Number(form.packSizeG) : null,
      unitsPerCase: form.unitsPerCase ? Number(form.unitsPerCase) : null,
      reorderPointOverride: form.reorderPointOverride ? Number(form.reorderPointOverride) : null,
      xeroItemCode: form.xeroItemCode || null,
      apBrandEquivalent: form.apBrandEquivalent || null,
      notes: form.notes || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-900">Add product</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SKU code *</label>
            <input
              type="text"
              value={form.skuCode}
              onChange={(e) => setForm({ ...form, skuCode: e.target.value.toUpperCase() })}
              placeholder="e.g. HHCC30"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })}
              placeholder="e.g. NP, HH"
              maxLength={10}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product name *</label>
          <input
            type="text"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. CHEWS, SPRAY"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary location</label>
            <select
              value={form.primaryStockLocation}
              onChange={(e) => setForm({ ...form, primaryStockLocation: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="THH">THH</option>
              <option value="88">88</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
          <select
            value={form.manufacturerId}
            onChange={(e) => setForm({ ...form, manufacturerId: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          >
            <option value="">Not assigned (TBC)</option>
            {manufacturers.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pack size (g)</label>
            <input
              type="number"
              value={form.packSizeG}
              onChange={(e) => setForm({ ...form, packSizeG: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Units/case</label>
            <input
              type="number"
              value={form.unitsPerCase}
              onChange={(e) => setForm({ ...form, unitsPerCase: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RP override</label>
            <input
              type="number"
              value={form.reorderPointOverride}
              onChange={(e) => setForm({ ...form, reorderPointOverride: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Xero item code</label>
            <input
              type="text"
              value={form.xeroItemCode}
              onChange={(e) => setForm({ ...form, xeroItemCode: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AP brand equivalent</label>
            <input
              type="text"
              value={form.apBrandEquivalent}
              onChange={(e) => setForm({ ...form, apBrandEquivalent: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create product"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProductModal({
  product,
  manufacturers,
  onSave,
  onClose,
  saving,
}: {
  product: any;
  manufacturers: any[];
  onSave: (updates: any) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    productName: product.productName,
    manufacturerId: product.manufacturerId ?? "",
    reorderPointOverride: product.reorderPointOverride ?? "",
    xeroItemCode: product.xeroItemCode ?? "",
    notes: product.notes ?? "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          Edit {product.skuCode} — {product.productName}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Manufacturer
            </label>
            <select
              value={form.manufacturerId}
              onChange={(e) =>
                setForm({
                  ...form,
                  manufacturerId: e.target.value ? Number(e.target.value) : "",
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="">Not assigned (TBC)</option>
              {manufacturers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reorder Point Override
            </label>
            <input
              type="number"
              value={form.reorderPointOverride}
              onChange={(e) =>
                setForm({
                  ...form,
                  reorderPointOverride: e.target.value ? Number(e.target.value) : "",
                })
              }
              placeholder="Leave empty to use calculated value"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Xero Item Code
            </label>
            <input
              type="text"
              value={form.xeroItemCode}
              onChange={(e) => setForm({ ...form, xeroItemCode: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() =>
              onSave({
                productName: form.productName,
                manufacturerId: form.manufacturerId || null,
                reorderPointOverride: form.reorderPointOverride || null,
                xeroItemCode: form.xeroItemCode || null,
                notes: form.notes || null,
              })
            }
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ManufacturersTab() {
  const qc = useQueryClient();
  const { data: manufacturers = [] } = useQuery<any[]>({
    queryKey: ["manufacturers"],
    queryFn: () => apiRequest("/api/manufacturers"),
  });
  const [editing, setEditing] = useState<any>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) =>
      apiRequest(`/api/manufacturers/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manufacturers"] });
      setEditing(null);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Lead Time (days)</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Max Lead Time</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {manufacturers.map((m: any) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{m.name}</td>
              <td className="px-4 py-3">{m.email ?? <span className="text-amber-600">Not set</span>}</td>
              <td className="px-4 py-3">{m.contactPerson ?? "—"}</td>
              <td className="px-4 py-3 text-right">{m.standardLeadTimeDays}</td>
              <td className="px-4 py-3 text-right">{m.maxLeadTimeDays}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => setEditing(m)} className="text-xs text-primary hover:underline">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <EditManufacturerModal
          manufacturer={editing}
          onSave={(updates) => updateMutation.mutate({ id: editing.id, updates })}
          onClose={() => setEditing(null)}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditManufacturerModal({
  manufacturer,
  onSave,
  onClose,
  saving,
}: {
  manufacturer: any;
  onSave: (updates: any) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: manufacturer.name ?? "",
    email: manufacturer.email ?? "",
    contactPerson: manufacturer.contactPerson ?? "",
    phone: manufacturer.phone ?? "",
    standardLeadTimeDays: manufacturer.standardLeadTimeDays ?? 40,
    maxLeadTimeDays: manufacturer.maxLeadTimeDays ?? 60,
    poFormatNotes: manufacturer.poFormatNotes ?? "",
    moqNotes: manufacturer.moqNotes ?? "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Edit {manufacturer.name}</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="manufacturer@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
            <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (days)</label>
              <input type="number" value={form.standardLeadTimeDays} onChange={(e) => setForm({ ...form, standardLeadTimeDays: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Lead Time (days)</label>
              <input type="number" value={form.maxLeadTimeDays} onChange={(e) => setForm({ ...form, maxLeadTimeDays: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PO Format Notes</label>
            <textarea value={form.poFormatNotes} onChange={(e) => setForm({ ...form, poFormatNotes: e.target.value })}
              rows={2} placeholder="Any special instructions for purchase orders"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MOQ Notes</label>
            <textarea value={form.moqNotes} onChange={(e) => setForm({ ...form, moqNotes: e.target.value })}
              rows={2} placeholder="Minimum order quantities or batch requirements"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SystemSettingsTab() {
  const { data: xeroStatus } = useQuery<any>({
    queryKey: ["xero-status"],
    queryFn: () => apiRequest("/api/xero/status"),
  });
  const qc = useQueryClient();

  const disconnectXero = useMutation({
    mutationFn: () => apiRequest("/api/xero/disconnect", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xero-status"] }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-border p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Business Details</h3>
        <p className="text-sm text-slate-500">
          Business address, VAT number, and contact details can be configured here.
          This data is used in purchase orders and courier bookings.
        </p>
        <p className="text-xs text-slate-400 mt-2">Coming soon — system settings will be fully configurable.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-6">
        <h3 className="font-semibold text-slate-900 mb-4">8/8 Warehouse Settings</h3>
        <p className="text-sm text-slate-500">
          Contact email and person name for dispatch instructions.
        </p>
        <p className="text-xs text-slate-400 mt-2">Coming soon.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Integrations</h3>
        <div className="space-y-3">
          {/* Xero */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-sm">Xero</p>
              <p className="text-xs text-slate-500">
                {xeroStatus?.connected
                  ? `Connected to: ${xeroStatus.organisationName}`
                  : "Not connected"}
              </p>
            </div>
            {xeroStatus?.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  Connected
                </span>
                <button
                  onClick={() => disconnectXero.mutate()}
                  className="text-xs text-red-500 hover:underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/auth/xero"
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
              >
                Connect Xero
              </a>
            )}
          </div>

          {/* Gmail */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="font-medium text-sm">Gmail</p>
              <p className="text-xs text-slate-500">Email drafting</p>
            </div>
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
              Phase 1 — Copy & Paste
            </span>
          </div>

          {/* Couriers */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="font-medium text-sm">Bob Go / The Courier Guy</p>
              <p className="text-xs text-slate-500">Courier booking</p>
            </div>
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
              Phase 1 — Manual Entry
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

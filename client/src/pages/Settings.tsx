import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex gap-1 border-b border-border">
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
      </div>

      {activeTab === "products" && <ProductsTab />}
      {activeTab === "manufacturers" && <ManufacturersTab />}
      {activeTab === "system" && <SystemSettingsTab />}
    </div>
  );
}

function ProductsTab() {
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: () => apiRequest("/api/products"),
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
      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border border-border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
      />

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
                <tr key={p.skuCode} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.skuCode}</td>
                  <td className="px-4 py-3">{p.productName}</td>
                  <td className="px-4 py-3">{p.brand}</td>
                  <td className="px-4 py-3">{p.category.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    {p.manufacturerName ?? <span className="text-amber-600">TBC</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{p.unitsPerCase ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{p.reorderPointOverride ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingProduct(p)}
                      className="text-primary hover:underline text-xs"
                    >
                      Edit
                    </button>
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
  const { data: manufacturers = [] } = useQuery<any[]>({
    queryKey: ["manufacturers"],
    queryFn: () => apiRequest("/api/manufacturers"),
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">
              Lead Time (days)
            </th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">
              Max Lead Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {manufacturers.map((m: any) => (
            <tr key={m.id}>
              <td className="px-4 py-3 font-medium">{m.name}</td>
              <td className="px-4 py-3">{m.email ?? <span className="text-slate-400">Not set</span>}</td>
              <td className="px-4 py-3">{m.contactPerson ?? "—"}</td>
              <td className="px-4 py-3 text-right">{m.standardLeadTimeDays}</td>
              <td className="px-4 py-3 text-right">{m.maxLeadTimeDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

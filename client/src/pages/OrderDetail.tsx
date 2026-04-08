import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import StickyActionBar from "../components/StickyActionBar";

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderLine {
  id?: number;
  skuCode: string;
  productName?: string;
  sizeVariant: string;
  quantity: number;
  availableQuantity?: number;
  shortfall?: number;
}

interface Order {
  id: number;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryStreet: string;
  deliverySuburb: string;
  deliveryCity: string;
  deliveryProvince: string;
  deliveryPostalCode: string;
  salesChannel: string;
  orderReference: string;
  specialInstructions: string;
  status: string;
  xeroInvoiceRef: string | null;
  lines: OrderLine[];
}

interface InvoiceData {
  date: string;
  customer: string;
  reference: string;
  taxRate: string;
  currency: string;
  lineItems: {
    itemCode: string;
    description: string;
    quantity: number;
  }[];
}

interface CourierData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryStreet: string;
  deliverySuburb: string;
  deliveryCity: string;
  deliveryProvince: string;
  deliveryPostalCode: string;
  orderReference: string;
  specialInstructions: string;
  courierService: string | null;
  waybillNumber: string | null;
  parcels: { description: string; quantity: number }[];
}

interface ProductOption {
  skuCode: string;
  productName: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUSES = ["RECEIVED", "CONFIRMED", "INVOICED", "DISPATCHED"] as const;

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-500",
  CONFIRMED: "bg-amber-500",
  INVOICED: "bg-purple-500",
  DISPATCHED: "bg-green-500",
};

const CHANNELS = ["Website", "Takealot", "Wholesale", "Retail", "Other"];

const TABS = ["Order Details", "Stock Check", "Invoice", "Courier", "Summary"] as const;

// ── Component ──────────────────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Order Details");

  // ── Fetch existing order ─────────────────────────────────────────────

  const { data: order, isLoading: loadingOrder } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () => apiRequest(`/api/orders/${id}`),
    enabled: !isNew,
  });

  // ── New-order form state ─────────────────────────────────────────────

  const [form, setForm] = useState({
    orderDate: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryStreet: "",
    deliverySuburb: "",
    deliveryCity: "",
    deliveryProvince: "",
    deliveryPostalCode: "",
    salesChannel: "Website",
    orderReference: "",
    specialInstructions: "",
  });

  const [lines, setLines] = useState<OrderLine[]>([
    { skuCode: "", sizeVariant: "", quantity: 1 },
  ]);

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ["products"],
    queryFn: () => apiRequest("/api/products"),
    enabled: isNew,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["snapshot-overview"] });
      navigate(`/orders/${data.id}`);
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ ...form, lines });
  }

  function updateLine(index: number, field: keyof OrderLine, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { skuCode: "", sizeVariant: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Status advance ───────────────────────────────────────────────────

  const advanceStatusMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/orders/${id}/status`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["snapshot-overview"] });
    },
  });

  // ── Loading / not found ──────────────────────────────────────────────

  if (!isNew && loadingOrder) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isNew && !order) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Order not found.</p>
        <Link to="/orders" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/orders"
          className="text-sm text-slate-500 hover:text-primary mb-1 inline-block"
        >
          &larr; Back to Orders
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? "New Order" : `Order ${order!.orderReference}`}
        </h1>
        {!isNew && (
          <p className="text-slate-500 mt-1">
            {order!.customerName} &middot; {order!.salesChannel} &middot;{" "}
            {new Date(order!.orderDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {(isNew || activeTab === "Order Details") && (
        <OrderDetailsTab
          isNew={isNew}
          order={order ?? null}
          form={form}
          setForm={setForm}
          lines={lines}
          products={products}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
          handleCreate={handleCreate}
          createMutation={createMutation}
          advanceStatusMutation={advanceStatusMutation}
        />
      )}

      {!isNew && activeTab === "Stock Check" && <StockCheckTab order={order!} />}

      {!isNew && activeTab === "Invoice" && <InvoiceTab orderId={id!} order={order!} />}

      {!isNew && activeTab === "Courier" && <CourierTab orderId={id!} />}

      {!isNew && activeTab === "Summary" && <SummaryTab order={order!} />}
    </div>
  );
}

// ── Status Timeline ────────────────────────────────────────────────────────

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUSES.indexOf(currentStatus as any);

  return (
    <div className="flex items-center gap-2">
      {STATUSES.map((status, i) => {
        const isCompleted = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={status} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted
                    ? `${STATUS_COLORS[status]} text-white`
                    : "bg-slate-200 text-slate-500"
                } ${isCurrent ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs mt-1 ${
                  isCompleted ? "text-slate-900 font-medium" : "text-slate-400"
                }`}
              >
                {status}
              </span>
            </div>
            {i < STATUSES.length - 1 && (
              <div
                className={`w-12 h-0.5 ${
                  i < currentIndex ? "bg-slate-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 1: Order Details ───────────────────────────────────────────────────

function OrderDetailsTab({
  isNew,
  order,
  form,
  setForm,
  lines,
  products,
  updateLine,
  addLine,
  removeLine,
  handleCreate,
  createMutation,
  advanceStatusMutation,
}: {
  isNew: boolean;
  order: Order | null;
  form: any;
  setForm: (fn: any) => void;
  lines: OrderLine[];
  products: ProductOption[];
  updateLine: (i: number, field: keyof OrderLine, value: string | number) => void;
  addLine: () => void;
  removeLine: (i: number) => void;
  handleCreate: (e: React.FormEvent) => void;
  createMutation: any;
  advanceStatusMutation: any;
}) {
  if (isNew) {
    return (
      <form onSubmit={handleCreate} className="space-y-6">
        {/* Order Info */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Order Date</label>
              <input
                type="date"
                value={form.orderDate}
                onChange={(e) => setForm((f: any) => ({ ...f, orderDate: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Order Reference</label>
              <input
                type="text"
                value={form.orderReference}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, orderReference: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Sales Channel</label>
              <select
                value={form.salesChannel}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, salesChannel: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Customer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, customerName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, customerEmail: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, customerPhone: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Delivery Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Street</label>
              <input
                type="text"
                value={form.deliveryStreet}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, deliveryStreet: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Suburb</label>
              <input
                type="text"
                value={form.deliverySuburb}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, deliverySuburb: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={form.deliveryCity}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, deliveryCity: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Province</label>
              <input
                type="text"
                value={form.deliveryProvince}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, deliveryProvince: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Postal Code</label>
              <input
                type="text"
                value={form.deliveryPostalCode}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, deliveryPostalCode: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Special Instructions</h2>
          <textarea
            value={form.specialInstructions}
            onChange={(e) =>
              setForm((f: any) => ({ ...f, specialInstructions: e.target.value }))
            }
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Any special instructions for this order..."
          />
        </div>

        {/* Product Lines */}
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Order Lines</h2>
            <button
              type="button"
              onClick={addLine}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
            >
              + Add Line
            </button>
          </div>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-slate-600 mb-1">Product</label>
                  <select
                    value={line.skuCode}
                    onChange={(e) => updateLine(i, "skuCode", e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.skuCode} value={p.skuCode}>
                        {p.productName} ({p.skuCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-sm text-slate-600 mb-1">Size Variant</label>
                  <input
                    type="text"
                    value={line.sizeVariant}
                    onChange={(e) => updateLine(i, "sizeVariant", e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. 500g"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm text-slate-600 mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <StickyActionBar>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Order"}
          </button>
        </StickyActionBar>
        {createMutation.isError && (
          <p className="text-red-600 text-sm">
            Error: {(createMutation.error as Error).message}
          </p>
        )}
      </form>
    );
  }

  // ── Existing order: read-only view ─────────────────────────────────────

  const o = order!;
  const currentIndex = STATUSES.indexOf(o.status as any);
  const canAdvance = currentIndex < STATUSES.length - 1;

  return (
    <div className="space-y-6">
      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Order Status</h2>
          {canAdvance && (
            <button
              onClick={() => advanceStatusMutation.mutate()}
              disabled={advanceStatusMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {advanceStatusMutation.isPending
                ? "Updating..."
                : `Advance to ${STATUSES[currentIndex + 1]}`}
            </button>
          )}
        </div>
        <StatusTimeline currentStatus={o.status} />
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Order Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Order Date</p>
            <p className="font-medium">{new Date(o.orderDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Reference</p>
            <p className="font-medium">{o.orderReference}</p>
          </div>
          <div>
            <p className="text-slate-500">Sales Channel</p>
            <p className="font-medium">{o.salesChannel}</p>
          </div>
          <div>
            <p className="text-slate-500">Status</p>
            <p className="font-medium">{o.status}</p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Customer Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Name</p>
            <p className="font-medium">{o.customerName}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium">{o.customerEmail || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Phone</p>
            <p className="font-medium">{o.customerPhone || "—"}</p>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Delivery Address</h2>
        <p className="text-sm">
          {[o.deliveryStreet, o.deliverySuburb, o.deliveryCity, o.deliveryProvince, o.deliveryPostalCode]
            .filter(Boolean)
            .join(", ") || "—"}
        </p>
      </div>

      {/* Special Instructions */}
      {o.specialInstructions && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Special Instructions</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{o.specialInstructions}</p>
        </div>
      )}

      {/* Order Lines */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-slate-900">
            Order Lines ({o.lines.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Size</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {o.lines.map((line, i) => (
              <tr key={line.id ?? i}>
                <td className="px-4 py-3">
                  <span className="font-medium">{line.productName ?? line.skuCode}</span>
                  <span className="text-slate-400 ml-2 text-xs">{line.skuCode}</span>
                </td>
                <td className="px-4 py-3">{line.sizeVariant || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 2: Stock Check ─────────────────────────────────────────────────────

function StockCheckTab({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-semibold text-slate-900">Stock Availability</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Ordered</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Available</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Shortfall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {order.lines.map((line, i) => {
            const shortfall = line.shortfall ?? 0;
            return (
              <tr key={line.id ?? i}>
                <td className="px-4 py-3">
                  <span className="font-medium">{line.productName ?? line.skuCode}</span>
                  {line.sizeVariant && (
                    <span className="text-slate-400 ml-2 text-xs">{line.sizeVariant}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {line.availableQuantity ?? "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium ${
                    shortfall > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {shortfall > 0 ? `-${shortfall}` : "0"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 3: Invoice ─────────────────────────────────────────────────────────

function InvoiceTab({ orderId, order }: { orderId: string; order: Order }) {
  const queryClient = useQueryClient();

  const { data: invoiceData, isLoading } = useQuery<InvoiceData>({
    queryKey: ["order-invoice", orderId],
    queryFn: () => apiRequest(`/api/orders/${orderId}/invoice-data`),
  });

  const [xeroRef, setXeroRef] = useState(order.xeroInvoiceRef ?? "");
  const [copied, setCopied] = useState(false);

  const saveXeroRefMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ xeroInvoiceRef: xeroRef }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  function copyToClipboard() {
    if (!invoiceData) return;
    const header = "Item Code\tDescription\tQuantity";
    const rows = invoiceData.lineItems
      .map((item) => `${item.itemCode}\t${item.description}\t${item.quantity}`)
      .join("\n");
    navigator.clipboard.writeText(`${header}\n${rows}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="bg-white rounded-xl border border-border p-6 text-center text-slate-500">
        No invoice data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Metadata */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Invoice Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Date</p>
            <p className="font-medium">{new Date(invoiceData.date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Customer</p>
            <p className="font-medium">{invoiceData.customer}</p>
          </div>
          <div>
            <p className="text-slate-500">Reference</p>
            <p className="font-medium">{invoiceData.reference}</p>
          </div>
          <div>
            <p className="text-slate-500">Tax Rate</p>
            <p className="font-medium">{invoiceData.taxRate}</p>
          </div>
          <div>
            <p className="text-slate-500">Currency</p>
            <p className="font-medium">{invoiceData.currency}</p>
          </div>
        </div>
      </div>

      {/* Xero Reference */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Xero Invoice Reference</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={xeroRef}
              onChange={(e) => setXeroRef(e.target.value)}
              placeholder="Enter Xero invoice reference..."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => saveXeroRefMutation.mutate()}
            disabled={saveXeroRefMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saveXeroRefMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
        {saveXeroRefMutation.isSuccess && (
          <p className="text-green-600 text-xs mt-2">Saved successfully.</p>
        )}
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Xero Line Items</h2>
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Item Code</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoiceData.lineItems.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-mono">{item.itemCode}</td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 4: Courier ─────────────────────────────────────────────────────────

function CourierTab({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();

  const { data: courierData, isLoading } = useQuery<CourierData>({
    queryKey: ["order-courier", orderId],
    queryFn: () => apiRequest(`/api/orders/${orderId}/courier-data`),
  });

  const [courierService, setCourierService] = useState("");
  const [waybill, setWaybill] = useState("");
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync state once data loads
  if (courierData && !initialized) {
    setCourierService(courierData.courierService ?? "");
    setWaybill(courierData.waybillNumber ?? "");
    setInitialized(true);
  }

  const saveCourierMutation = useMutation({
    mutationFn: (payload: { courierService?: string; waybillNumber?: string }) =>
      apiRequest(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-courier", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  function copyBookingDetails() {
    if (!courierData) return;
    const details = [
      `Name: ${courierData.customerName}`,
      `Phone: ${courierData.customerPhone}`,
      `Email: ${courierData.customerEmail}`,
      `Address: ${[
        courierData.deliveryStreet,
        courierData.deliverySuburb,
        courierData.deliveryCity,
        courierData.deliveryProvince,
        courierData.deliveryPostalCode,
      ]
        .filter(Boolean)
        .join(", ")}`,
      `Reference: ${courierData.orderReference}`,
      courierData.specialInstructions
        ? `Instructions: ${courierData.specialInstructions}`
        : null,
      "",
      "Parcels:",
      ...courierData.parcels.map((p) => `  ${p.description} x${p.quantity}`),
    ]
      .filter((line) => line !== null)
      .join("\n");

    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!courierData) {
    return (
      <div className="bg-white rounded-xl border border-border p-6 text-center text-slate-500">
        No courier data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delivery Details */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Delivery Details</h2>
          <button
            onClick={copyBookingDetails}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            {copied ? "Copied!" : "Copy Booking Details"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Customer Name</p>
            <p className="font-medium">{courierData.customerName}</p>
          </div>
          <div>
            <p className="text-slate-500">Phone</p>
            <p className="font-medium">{courierData.customerPhone || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium">{courierData.customerEmail || "—"}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-slate-500">Delivery Address</p>
            <p className="font-medium">
              {[
                courierData.deliveryStreet,
                courierData.deliverySuburb,
                courierData.deliveryCity,
                courierData.deliveryProvince,
                courierData.deliveryPostalCode,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Order Reference</p>
            <p className="font-medium">{courierData.orderReference}</p>
          </div>
          {courierData.specialInstructions && (
            <div className="md:col-span-2">
              <p className="text-slate-500">Special Instructions</p>
              <p className="font-medium">{courierData.specialInstructions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Parcels */}
      {courierData.parcels.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-slate-900">Parcels</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courierData.parcels.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Courier Service */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Courier Service</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <select
              value={courierService}
              onChange={(e) => setCourierService(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select courier...</option>
              <option value="Bob Go">Bob Go</option>
              <option value="The Courier Guy">The Courier Guy</option>
            </select>
          </div>
          <button
            onClick={() => saveCourierMutation.mutate({ courierService })}
            disabled={saveCourierMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Waybill */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Waybill Number</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={waybill}
              onChange={(e) => setWaybill(e.target.value)}
              placeholder="Enter waybill number..."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => saveCourierMutation.mutate({ waybillNumber: waybill })}
            disabled={saveCourierMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {saveCourierMutation.isSuccess && (
          <p className="text-green-600 text-xs mt-2">Saved successfully.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Summary ─────────────────────────────────────────────────────────

function SummaryTab({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Order Status</h2>
        <StatusTimeline currentStatus={order.status} />
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Order Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Order Date</p>
            <p className="font-medium">{new Date(order.orderDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Reference</p>
            <p className="font-medium">{order.orderReference}</p>
          </div>
          <div>
            <p className="text-slate-500">Sales Channel</p>
            <p className="font-medium">{order.salesChannel}</p>
          </div>
          <div>
            <p className="text-slate-500">Status</p>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[order.status]
                  ? `${STATUS_COLORS[order.status]} text-white`
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Customer</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Name</p>
            <p className="font-medium">{order.customerName}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium">{order.customerEmail || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Phone</p>
            <p className="font-medium">{order.customerPhone || "—"}</p>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Delivery Address</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Street</p>
            <p className="font-medium">{order.deliveryStreet || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Suburb</p>
            <p className="font-medium">{order.deliverySuburb || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">City</p>
            <p className="font-medium">{order.deliveryCity || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Province</p>
            <p className="font-medium">{order.deliveryProvince || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Postal Code</p>
            <p className="font-medium">{order.deliveryPostalCode || "—"}</p>
          </div>
        </div>
      </div>

      {/* Special Instructions */}
      {order.specialInstructions && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Special Instructions</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {order.specialInstructions}
          </p>
        </div>
      )}

      {/* Xero Invoice Reference */}
      {order.xeroInvoiceRef && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Xero Invoice Reference</h2>
          <p className="text-sm font-mono">{order.xeroInvoiceRef}</p>
        </div>
      )}

      {/* Order Lines */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-slate-900">
            Order Lines ({order.lines.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Size</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Quantity</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Available</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Shortfall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.lines.map((line, i) => {
              const shortfall = line.shortfall ?? 0;
              return (
                <tr key={line.id ?? i}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{line.productName ?? line.skuCode}</span>
                    <span className="text-slate-400 ml-2 text-xs">{line.skuCode}</span>
                  </td>
                  <td className="px-4 py-3">{line.sizeVariant || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {line.availableQuantity ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium ${
                      shortfall > 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {shortfall > 0 ? `-${shortfall}` : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

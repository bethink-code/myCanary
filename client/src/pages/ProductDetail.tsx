import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { formatStock, formatDateShort } from "../lib/formatters";

interface Product {
  id: number;
  skuCode: string;
  productName: string;
  brand: string;
  category: string;
  packSizeG: number | null;
  unitsPerCase: number | null;
  manufacturerName: string | null;
  primaryStockLocation: string;
  reorderPointOverride: number | null;
  xeroItemCode: string | null;
  notes: string | null;
}

interface Batch {
  id: number;
  skuCode: string;
  sizeVariant: string;
  stockLocation: string;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  initialQuantity: number;
  isActive: boolean;
  receivedDate: string;
  deliveryNoteRef: string | null;
  remaining?: number;
}

interface Transaction {
  id: number;
  transactionType: string;
  quantity: number;
  transactionDate: string;
  stockLocation: string;
  reference: string | null;
  channel: string | null;
  notes: string | null;
}

function isExpiringSoon(expiryDate: string): boolean {
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return new Date(expiryDate) <= sixMonths;
}

const TYPE_LABELS: Record<string, string> = {
  DELIVERY_IN: "Stock In: Delivery",
  SALES_OUT: "Stock Out: Sales",
  PNP_OUT: "Stock Out: PnP Dispatch",
  TRANSFER_THH_TO_88: "Transfer: THH to 8/8",
  ADJUSTMENT: "Adjustment",
};

export default function ProductDetail() {
  const { skuCode } = useParams<{ skuCode: string }>();

  const { data: product, isLoading: loadingProduct } = useQuery<Product>({
    queryKey: ["product", skuCode],
    queryFn: () => apiRequest(`/api/products/${skuCode}`),
  });

  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["batches", skuCode],
    queryFn: () => apiRequest(`/api/batches/${skuCode}`),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", skuCode],
    queryFn: () => apiRequest(`/api/stock/transactions/${skuCode}`),
  });

  if (loadingProduct) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Product not found.</p>
        <Link to="/stock" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Stock Management
        </Link>
      </div>
    );
  }

  const activeBatches = batches.filter((b) => b.isActive);
  const thhStock = transactions
    .filter((t) => t.stockLocation === "THH")
    .reduce((sum, t) => sum + t.quantity, 0);
  const eeStock = transactions
    .filter((t) => t.stockLocation === "88")
    .reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/stock"
            className="text-sm text-slate-500 hover:text-primary mb-1 inline-block"
          >
            &larr; Back to Stock Management
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{product.productName}</h1>
          <p className="text-slate-500 mt-1">
            SKU: {product.skuCode} &middot; {product.brand} &middot;{" "}
            {product.category.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-sm text-slate-500">THH On Hand</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatStock(thhStock, product.unitsPerCase, product.category)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-sm text-slate-500">8/8 On Hand</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatStock(eeStock, product.unitsPerCase, product.category)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-sm text-slate-500">Reorder Point</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {product.reorderPointOverride !== null
              ? formatStock(product.reorderPointOverride, product.unitsPerCase, product.category)
              : "Not set"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-sm text-slate-500">Manufacturer</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {product.manufacturerName ?? <span className="text-amber-600">TBC</span>}
          </p>
        </div>
      </div>

      {/* Product Details */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Product Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Pack Size</p>
            <p className="font-medium">{product.packSizeG ? `${product.packSizeG}g` : "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Units Per Case</p>
            <p className="font-medium">{product.unitsPerCase ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-500">Primary Location</p>
            <p className="font-medium">
              {product.primaryStockLocation === "THH" ? "THH Premises" : "8/8 Warehouse"}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Xero Item Code</p>
            <p className="font-medium">{product.xeroItemCode ?? "—"}</p>
          </div>
        </div>
        {product.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            {product.notes}
          </div>
        )}
      </div>

      {/* Active Batches */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-slate-900">
            Active Batches ({activeBatches.length})
          </h2>
        </div>
        {activeBatches.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Batch #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Manufactured</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Expires</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Initial Qty</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Delivery Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeBatches.map((batch) => (
                <tr
                  key={batch.id}
                  className={isExpiringSoon(batch.expiryDate) ? "bg-amber-50" : ""}
                >
                  <td className="px-4 py-3 font-mono">{batch.batchNumber}</td>
                  <td className="px-4 py-3">{batch.sizeVariant}</td>
                  <td className="px-4 py-3">
                    {batch.stockLocation === "THH" ? "THH" : "8/8"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateShort(batch.manufactureDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isExpiringSoon(batch.expiryDate) ? "text-amber-700 font-medium" : ""
                      }
                    >
                      {formatDateShort(batch.expiryDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {batch.initialQuantity}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {batch.deliveryNoteRef ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-slate-500 text-sm">
            No active batches for this product.
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-slate-900">
            Transaction History ({transactions.length})
          </h2>
        </div>
        {transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Quantity</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.slice(0, 50).map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3">
                    {formatDateShort(tx.transactionDate)}
                  </td>
                  <td className="px-4 py-3">
                    {TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                  </td>
                  <td className="px-4 py-3">
                    {tx.stockLocation === "THH" ? "THH" : "8/8"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      tx.quantity > 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {tx.quantity > 0 ? "+" : ""}
                    {tx.quantity}
                  </td>
                  <td className="px-4 py-3">{tx.channel ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{tx.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                    {tx.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-slate-500 text-sm">
            No transactions recorded yet.
          </div>
        )}
      </div>

      <ProductBomSection skuCode={skuCode!} />
    </div>
  );
}

interface ProductBomMapping {
  id: number;
  supplyId: number;
  skuCode: string;
  quantityPerUnit: number;
  notes: string | null;
  supplyName: string | null;
  supplyUnit: string | null;
}

function ProductBomSection({ skuCode }: { skuCode: string }) {
  const { data: mappings = [], isLoading } = useQuery<ProductBomMapping[]>({
    queryKey: ["product-bom", skuCode],
    queryFn: () => apiRequest(`/api/supply-mappings/by-product/${skuCode}`),
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold">Bill of materials</h2>
        <Link
          to="/settings?tab=bom-matrix"
          className="text-xs text-primary hover:underline"
        >
          Edit in Settings
        </Link>
      </div>
      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : mappings.length === 0 ? (
        <div className="px-6 py-8 text-center text-slate-500 text-sm">
          No supplies mapped to this SKU yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Supply</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Qty per unit</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Unit</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mappings.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">{m.supplyName ?? `Supply #${m.supplyId}`}</td>
                <td className="px-4 py-3 text-right font-mono">{m.quantityPerUnit}</td>
                <td className="px-4 py-3 text-slate-500">{m.supplyUnit ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{m.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

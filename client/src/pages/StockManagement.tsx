import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { formatStock, calcStockStatus, getStatusBadge, formatDateShort } from "../lib/formatters";

interface StockItem {
  skuCode: string;
  productName: string;
  category: string;
  brand: string;
  unitsPerCase: number | null;
  primaryStockLocation: string;
  manufacturerName: string | null;
  thhStock: number;
  eightEightStock: number;
  reorderPoint: number | null;
}

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "HORSE_MIX", label: "Horse Mixes" },
  { value: "PET_FORMULA", label: "Pet Formulas" },
  { value: "CHEW", label: "Chews" },
  { value: "SPRAY", label: "Sprays" },
  { value: "SHAMPOO", label: "Shampoo" },
  { value: "GRAVY", label: "Gravy" },
  { value: "OTHER", label: "Other" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "REORDER", label: "Reorder Now" },
  { value: "APPROACHING_AND_REORDER", label: "Approaching + Reorder" },
];

export default function StockManagement() {
  const { isAdmin } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stockItems = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ["stock-summary"],
    queryFn: () => apiRequest("/api/stock/summary"),
  });

  const { data: ledgerData } = useQuery<{ ledgerStartDate: string | null; hasOpeningBalance: boolean }>({
    queryKey: ["ledger-date"],
    queryFn: () => apiRequest("/api/xero/import/ledger-date"),
  });

  const filtered = stockItems.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (locationFilter && item.primaryStockLocation !== locationFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !item.skuCode.toLowerCase().includes(term) &&
        !item.productName.toLowerCase().includes(term)
      )
        return false;
    }
    if (statusFilter) {
      const stock =
        item.primaryStockLocation === "88" ? item.eightEightStock : item.thhStock;
      const status = calcStockStatus(stock, item.reorderPoint);
      if (statusFilter === "REORDER" && status !== "REORDER") return false;
      if (
        statusFilter === "APPROACHING_AND_REORDER" &&
        status !== "REORDER" &&
        status !== "APPROACHING"
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Stock Levels</h1>
          <Link
            to="/stock/reorder"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Run Stock Check
          </Link>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          On Hand = Stock In (deliveries) minus Stock Out (sales). Negative means more has been sold than received.
        </p>
      </div>

      {/* Stock In / Stock Out action bar */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-800 text-sm mb-2">Stock In (adds inventory)</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/stock/opening-balance"
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
              >
                Import Opening Balances
              </Link>
              <Link
                to="/stock/delivery"
                className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
              >
                Record Manufacturer Delivery
              </Link>
            </div>
            <p className="text-xs text-green-600 mt-2">
              Opening balances: one-time import from Animal Farm spreadsheet. Deliveries: each time Zinchar/Nutrimed ships.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-800 text-sm mb-2">Stock Out (removes inventory)</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/xero/import"
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
              >
                Import Sales from Xero
              </Link>
              <Link
                to="/pnp"
                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100"
              >
                PnP Dispatch (8/8)
              </Link>
              <Link
                to="/stock/transfer"
                className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100"
              >
                Transfer THH → 8/8
              </Link>
            </div>
            <p className="text-xs text-red-600 mt-2">
              Sales from Xero debit THH stock. PnP dispatches debit 8/8 stock. Transfers move between locations.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Locations</option>
          <option value="THH">THH Premises</option>
          <option value="88">8/8 Warehouse</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stock Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Product
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Category
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Manufacturer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const primaryStock =
                    item.primaryStockLocation === "88"
                      ? item.eightEightStock
                      : item.thhStock;
                  const status = getStatusBadge(calcStockStatus(primaryStock, item.reorderPoint));

                  return (
                    <tr key={item.skuCode} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/stock/product/${item.skuCode}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {item.productName}
                        </Link>
                        <span className="text-slate-400 ml-2 text-xs">
                          {item.skuCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.category.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatStock(item.thhStock, item.unitsPerCase, item.category)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.primaryStockLocation === "88" ||
                        item.brand === "NP" ||
                        item.eightEightStock > 0
                          ? formatStock(
                              item.eightEightStock,
                              item.unitsPerCase,
                              item.category
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.reorderPoint !== null
                          ? formatStock(
                              item.reorderPoint,
                              item.unitsPerCase,
                              item.category
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.manufacturerName ?? (
                          <span className="text-amber-600">TBC</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No products match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
            Showing {filtered.length} of {stockItems.length} products
          </div>
        </div>
      )}
    </div>
  );
}

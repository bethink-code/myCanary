import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Link } from "react-router-dom";
import { formatDateShort } from "../lib/formatters";

interface OrderSummary {
  id: number;
  orderDate: string;
  orderReference: string;
  customerName: string;
  salesChannel: string;
  status: string;
  lineCount: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "RECEIVED", label: "Received" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "DISPATCHED", label: "Dispatched" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "All Channels" },
  { value: "Website", label: "Website" },
  { value: "Takealot", label: "Takealot" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Retail", label: "Retail" },
  { value: "Other", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-amber-100 text-amber-700",
  INVOICED: "bg-purple-100 text-purple-700",
  DISPATCHED: "bg-green-100 text-green-700",
};

export default function OrderList() {
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const { data: orders = [], isLoading } = useQuery<OrderSummary[]>({
    queryKey: ["orders"],
    queryFn: () => apiRequest("/api/orders"),
  });

  const filtered = orders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (channelFilter && order.salesChannel !== channelFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customer Orders</h1>
        <Link
          to="/sales/customer-orders/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CHANNEL_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Channel</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Items</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {formatDateShort(order.orderDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/sales/customer-orders/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.orderReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3 text-slate-600">{order.salesChannel}</td>
                    <td className="px-4 py-3 text-right font-mono">{order.lineCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/sales/customer-orders/${order.id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No orders match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-border text-xs text-slate-500">
            Showing {filtered.length} of {orders.length} orders
          </div>
        </div>
      )}
    </div>
  );
}

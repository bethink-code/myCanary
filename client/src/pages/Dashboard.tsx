import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

function StockHealthWidget() {
  const { data: stockItems = [], isLoading } = useQuery<any[]>({
    queryKey: ["stock-summary"],
    queryFn: () => apiRequest("/api/stock/summary"),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Stock Health</h2>
        <div className="flex justify-center py-4">
          <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const reorderCount = stockItems.filter((i) => {
    const stock = i.primaryStockLocation === "88" ? i.eightEightStock : i.thhStock;
    return i.reorderPoint && stock <= i.reorderPoint;
  }).length;

  const approachingCount = stockItems.filter((i) => {
    const stock = i.primaryStockLocation === "88" ? i.eightEightStock : i.thhStock;
    return i.reorderPoint && stock > i.reorderPoint && stock <= i.reorderPoint * 1.25;
  }).length;

  const okCount = stockItems.length - reorderCount - approachingCount;

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Stock Health</h2>
        <Link to="/stock" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{okCount}</p>
          <p className="text-xs text-green-600 mt-1">OK</p>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <p className="text-2xl font-bold text-amber-700">{approachingCount}</p>
          <p className="text-xs text-amber-600 mt-1">Approaching</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-700">{reorderCount}</p>
          <p className="text-xs text-red-600 mt-1">Reorder</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3">{stockItems.length} total products</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, {user?.firstName ?? user?.email}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/stock/reorder" className="p-6 bg-white rounded-xl border border-border hover:border-primary/50 transition-colors text-left block">
          <h3 className="font-semibold text-slate-900">Run Stock Check</h3>
          <p className="text-sm text-slate-500 mt-1">
            Check all products against reorder points
          </p>
        </Link>
        <Link to="/stock/delivery" className="p-6 bg-white rounded-xl border border-green-200 hover:border-green-400 transition-colors text-left block">
          <h3 className="font-semibold text-green-800">Stock In: Record Delivery</h3>
          <p className="text-sm text-slate-500 mt-1">
            Record goods received from manufacturer
          </p>
        </Link>
        <Link to="/xero/import" className="p-6 bg-white rounded-xl border border-red-200 hover:border-red-400 transition-colors text-left block">
          <h3 className="font-semibold text-red-800">Stock Out: Import Sales</h3>
          <p className="text-sm text-slate-500 mt-1">
            Pull sales data from Xero to debit stock
          </p>
        </Link>
      </div>

      {/* Stock Health Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockHealthWidget />

        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Alerts & Notifications</h2>
          <p className="text-sm text-slate-500">
            No alerts at this time.
          </p>
        </div>
      </div>
    </div>
  );
}

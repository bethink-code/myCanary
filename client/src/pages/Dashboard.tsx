import { useAuth } from "../hooks/useAuth";

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
        <button className="p-6 bg-white rounded-xl border border-border hover:border-primary/50 transition-colors text-left">
          <h3 className="font-semibold text-slate-900">Run Stock Check</h3>
          <p className="text-sm text-slate-500 mt-1">
            Check all products against reorder points
          </p>
        </button>
        <button className="p-6 bg-white rounded-xl border border-border hover:border-primary/50 transition-colors text-left">
          <h3 className="font-semibold text-slate-900">Process New Order</h3>
          <p className="text-sm text-slate-500 mt-1">
            Enter a new email order for fulfilment
          </p>
        </button>
        <button className="p-6 bg-white rounded-xl border border-border hover:border-primary/50 transition-colors text-left">
          <h3 className="font-semibold text-slate-900">Upload PnP Order</h3>
          <p className="text-sm text-slate-500 mt-1">
            Upload this week's Pick n Pay order file
          </p>
        </button>
      </div>

      {/* Placeholder widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Stock Health</h2>
          <p className="text-sm text-slate-500">
            Stock health overview will appear here once products and stock data are loaded.
          </p>
        </div>

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

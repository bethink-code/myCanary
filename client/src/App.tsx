import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { apiRequest } from "./lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import StockLanding from "./pages/StockLanding";
import ProductDetail from "./pages/ProductDetail";
import DeliveryReceipt from "./pages/DeliveryReceipt";
import ReorderWorkflow from "./pages/ReorderWorkflow";
import XeroImport from "./pages/XeroImport";
import TransferStock from "./pages/TransferStock";
import OrderList from "./pages/OrderList";
import OrderDetail from "./pages/OrderDetail";
import PnpWeekly from "./pages/PnpWeekly";
import OpeningBalance from "./pages/OpeningBalance";
import Settings from "./pages/Settings";
import OrdersLanding from "./pages/OrdersLanding";
import StockAdjustment from "./pages/StockAdjustment";
import Supplies from "./pages/Supplies";
import SupplyImport from "./pages/SupplyImport";
import SetupJourney from "./pages/SetupJourney";
import SalesLanding from "./pages/SalesLanding";
import NotificationBell from "./components/NotificationBell";
import NotFound from "./pages/not-found";
import { useState, useEffect } from "react";

// Flat 6-item nav. Every section is one click; no dropdowns.
const NAV_ITEMS: { to: string; label: string; admin?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/stock", label: "Stock" },
  { to: "/orders", label: "Orders" },
  { to: "/sales", label: "Sales" },
  { to: "/settings", label: "Settings" },
  { to: "/admin", label: "Admin", admin: true },
];

function isSectionActive(pathname: string, to: string): boolean {
  if (to === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }
  return pathname === to || pathname.startsWith(to + "/");
}

function TermsModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Terms of Use</h2>
        <p className="text-sm text-slate-600">
          By using this application, you agree to handle all business data
          confidentially and in accordance with your organisation's
          operational policies. All actions are logged for audit purposes.
        </p>
        <button
          onClick={onAccept}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
        >
          I Accept
        </button>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await apiRequest("/auth/logout", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["auth-user"] });
    window.location.href = "/";
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.admin || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="font-bold text-slate-900">
                MyCanary
              </Link>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-6">
                {visibleItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`text-sm transition-colors ${
                      isSectionActive(location.pathname, item.to)
                        ? "text-slate-900 font-medium"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 -ml-2 text-slate-600"
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="text-sm text-slate-500 hidden sm:inline">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
            {visibleItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  isSectionActive(location.pathname, item.to)
                    ? "text-primary bg-slate-50 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <Routes>
          {/* Home → Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Stock */}
          <Route path="/stock" element={<StockLanding />} />
          <Route path="/stock/product/:skuCode" element={<ProductDetail />} />
          <Route path="/stock/supplies" element={<Supplies />} />
          <Route path="/stock/transfer" element={<TransferStock />} />
          <Route path="/stock/adjustment" element={<StockAdjustment />} />

          {/* Orders (manufacturer POs) */}
          <Route path="/orders" element={<OrdersLanding />} />
          <Route path="/orders/reorder" element={<ReorderWorkflow />} />
          <Route path="/orders/delivery" element={<DeliveryReceipt />} />

          {/* Sales */}
          <Route path="/sales" element={<SalesLanding />} />
          <Route path="/sales/customer-orders" element={<OrderList />} />
          <Route path="/sales/customer-orders/new" element={<OrderDetail />} />
          <Route path="/sales/customer-orders/:id" element={<OrderDetail />} />
          <Route path="/sales/pnp" element={<PnpWeekly />} />
          <Route path="/sales/xero/import" element={<XeroImport />} />

          {/* Settings */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/opening-balance" element={<OpeningBalance />} />
          <Route path="/settings/supply-import" element={<SupplyImport />} />

          {/* Admin + Setup */}
          <Route path="/admin" element={<Admin />} />
          <Route path="/setup" element={<SetupJourney />} />

          {/* Legacy redirects — TODO(remove-after 2026-Q3) */}
          <Route path="/stock/reorder" element={<Navigate to="/orders/reorder" replace />} />
          <Route path="/stock/purchase-orders" element={<Navigate to="/orders" replace />} />
          <Route path="/stock/delivery" element={<Navigate to="/orders/delivery" replace />} />
          <Route path="/orders/new" element={<Navigate to="/sales/customer-orders/new" replace />} />
          <Route path="/pnp" element={<Navigate to="/sales/pnp" replace />} />
          <Route path="/xero/import" element={<Navigate to="/sales/xero/import" replace />} />
          <Route path="/tools/opening-balance" element={<Navigate to="/settings/opening-balance" replace />} />
          <Route path="/tools/supply-import" element={<Navigate to="/settings/supply-import" replace />} />
          <Route path="/tools/adjustment" element={<Navigate to="/stock/adjustment" replace />} />
          <Route path="/tools/transfer" element={<Navigate to="/stock/transfer" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
  }

  // Terms check
  if (!user?.termsAcceptedAt && !termsAccepted) {
    return (
      <TermsModal
        onAccept={async () => {
          await apiRequest("/api/user/accept-terms", { method: "POST" });
          qc.invalidateQueries({ queryKey: ["auth-user"] });
          setTermsAccepted(true);
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <SetupGate />
    </BrowserRouter>
  );
}

function SetupGate() {
  const location = useLocation();
  const { data: setupStatus, isLoading } = useQuery<{ setupComplete: boolean }>({
    queryKey: ["setup-status"],
    queryFn: () => apiRequest("/api/setup/status"),
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If setup incomplete and user is on the dashboard (or pre-redirect home), show the journey.
  // If they navigate to a specific page (via setup links), let them through.
  // The user can also explicitly skip setup via SetupJourney's "Skip for now" button.
  const onLanding = location.pathname === "/" || location.pathname === "/dashboard";
  const setupSkipped = typeof window !== "undefined" && localStorage.getItem("setup-skipped") === "true";
  if (setupStatus && !setupStatus.setupComplete && onLanding && !setupSkipped) {
    return <SetupJourney />;
  }

  return <AppLayout />;
}

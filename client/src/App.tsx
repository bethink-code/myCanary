import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { apiRequest } from "./lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Landing from "./pages/Landing";
import Snapshot from "./pages/Snapshot";
import Admin from "./pages/Admin";
import StockManagement from "./pages/StockManagement";
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
import PurchaseOrders from "./pages/PurchaseOrders";
import StockAdjustment from "./pages/StockAdjustment";
import SetupJourney from "./pages/SetupJourney";
import NotificationBell from "./components/NotificationBell";
import NotFound from "./pages/not-found";
import { useState, useRef, useEffect } from "react";

const STOCK_LINKS = [
  { to: "/stock", label: "Stock Levels" },
  { to: "/orders", label: "Orders" },
  { to: "/pnp", label: "PnP Weekly" },
  { to: "/xero/import", label: "Xero Import" },
  { to: "/stock/reorder", label: "Reorder" },
  { to: "/stock/purchase-orders", label: "Purchase Orders" },
  { to: "/stock/delivery", label: "Record Delivery" },
  { to: "/stock/adjustment", label: "Stock Adjustment" },
  { to: "/stock/transfer", label: "Transfer" },
  { to: "/stock/opening-balance", label: "Opening Balance" },
];

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

function StockDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const isStockRoute =
    location.pathname.startsWith("/stock") ||
    location.pathname.startsWith("/orders") ||
    location.pathname.startsWith("/pnp") ||
    location.pathname.startsWith("/xero");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`text-sm flex items-center gap-1 transition-colors ${
          isStockRoute ? "text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Stock
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl border border-border shadow-lg py-2 z-50">
          {STOCK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-2 text-sm transition-colors ${
                location.pathname === link.to
                  ? "text-primary bg-slate-50 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileStockMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  useEffect(() => {
    onClose();
  }, [location.pathname]);

  if (!open) return null;

  return (
    <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
      {STOCK_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={`block px-3 py-2 rounded-lg text-sm ${
            location.pathname === link.to
              ? "text-primary bg-slate-50 font-medium"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [mobileStockOpen, setMobileStockOpen] = useState(false);

  const handleLogout = async () => {
    await apiRequest("/auth/logout", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["auth-user"] });
    window.location.href = "/";
  };

  const isStockRoute =
    location.pathname.startsWith("/stock") ||
    location.pathname.startsWith("/orders") ||
    location.pathname.startsWith("/pnp") ||
    location.pathname.startsWith("/xero");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="font-bold text-slate-900">
                MyCanary
              </Link>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-6">
                <Link
                  to="/"
                  className={`text-sm transition-colors ${
                    location.pathname === "/"
                      ? "text-slate-900 font-medium"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Snapshot
                </Link>
                <StockDropdown />
                <Link
                  to="/settings"
                  className={`text-sm transition-colors ${
                    location.pathname === "/settings"
                      ? "text-slate-900 font-medium"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Settings
                </Link>
              </div>
              {/* Mobile nav */}
              <div className="flex md:hidden items-center gap-4">
                <Link
                  to="/"
                  className={`text-sm ${location.pathname === "/" ? "text-slate-900 font-medium" : "text-slate-600"}`}
                >
                  Snapshot
                </Link>
                <button
                  onClick={() => setMobileStockOpen(!mobileStockOpen)}
                  className={`text-sm flex items-center gap-1 ${
                    isStockRoute ? "text-slate-900 font-medium" : "text-slate-600"
                  }`}
                >
                  Stock
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${mobileStockOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <Link
                  to="/settings"
                  className={`text-sm ${location.pathname === "/settings" ? "text-slate-900 font-medium" : "text-slate-600"}`}
                >
                  Settings
                </Link>
              </div>
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
        <MobileStockMenu open={mobileStockOpen} onClose={() => setMobileStockOpen(false)} />
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <Routes>
          <Route path="/" element={<Snapshot />} />
          <Route path="/stock" element={<StockManagement />} />
          <Route path="/stock/product/:skuCode" element={<ProductDetail />} />
          <Route path="/stock/reorder" element={<ReorderWorkflow />} />
          <Route path="/stock/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/stock/adjustment" element={<StockAdjustment />} />
          <Route path="/stock/transfer" element={<TransferStock />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/new" element={<OrderDetail />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/pnp" element={<PnpWeekly />} />
          <Route path="/stock/delivery" element={<DeliveryReceipt />} />
          <Route path="/stock/opening-balance" element={<OpeningBalance />} />
          <Route path="/xero/import" element={<XeroImport />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/setup" element={<SetupJourney />} />
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

  // If setup incomplete and user is on the home page, show the journey.
  // If they navigate to a specific page (via setup links), let them through.
  if (setupStatus && !setupStatus.setupComplete && location.pathname === "/") {
    return <SetupJourney />;
  }

  return <AppLayout />;
}

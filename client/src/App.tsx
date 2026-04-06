import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { apiRequest } from "./lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import NotFound from "./pages/not-found";
import { useState } from "react";

function TermsModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Terms of Use</h2>
        <p className="text-sm text-slate-600">
          By using this application, you agree to handle all business data
          confidentially and in accordance with The Herbal Horse & Pet's
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

  const handleLogout = async () => {
    await apiRequest("/auth/logout", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["auth-user"] });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="font-bold text-slate-900">
                THH Operations
              </Link>
              <div className="hidden md:flex items-center gap-4">
                <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
                  Dashboard
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="text-sm text-slate-600 hover:text-slate-900">
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
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
      <AppLayout />
    </BrowserRouter>
  );
}

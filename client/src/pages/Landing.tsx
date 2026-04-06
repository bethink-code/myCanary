import { useState } from "react";

export default function Landing() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", cell: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              The Herbal Horse & Pet
            </h1>
            <p className="text-sm text-slate-500">Operations Management</p>
          </div>

          {!showRequestForm ? (
            <div className="space-y-4">
              <a
                href="/auth/google"
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </a>

              <div className="text-center">
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Request an invite
                </button>
              </div>
            </div>
          ) : submitted ? (
            <div className="text-center space-y-2">
              <p className="text-green-600 font-medium">Request submitted!</p>
              <p className="text-sm text-slate-500">
                You'll be notified when your access is approved.
              </p>
              <button
                onClick={() => {
                  setShowRequestForm(false);
                  setSubmitted(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <input
                type="text"
                placeholder="Full name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="email"
                placeholder="Email address"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="tel"
                placeholder="Cell number (optional)"
                value={formData.cell}
                onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90"
              >
                Submit Request
              </button>
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="w-full text-sm text-slate-500 hover:underline"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

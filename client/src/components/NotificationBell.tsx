import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  REORDER: "bg-red-100 text-red-700",
  APPROACHING: "bg-amber-100 text-amber-700",
  TRANSFER_NEEDED: "bg-orange-100 text-orange-700",
  NEGATIVE_STOCK: "bg-red-100 text-red-700",
  IMPORT_ERROR: "bg-red-100 text-red-700",
  ORDER_PROCESSED: "bg-green-100 text-green-700",
  PNP_DISPATCHED: "bg-green-100 text-green-700",
  PO_APPROVED: "bg-blue-100 text-blue-700",
  EXPIRY_WARNING: "bg-amber-100 text-amber-700",
  ACCESS_REQUEST: "bg-blue-100 text-blue-700",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiRequest("/api/notifications"),
    refetchInterval: 60000, // poll every minute
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-slate-500 hover:text-slate-700"
        title="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-border shadow-lg z-50 max-h-96 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-900">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-xs text-slate-500">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markRead.mutate(n.id);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-slate-50 transition-colors ${
                    n.isRead ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                        TYPE_COLORS[n.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {n.type.replace("_", " ")}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import StatusCards, { type StatusCardData } from "./StatusCards";

interface StockShellProps {
  title: string;
  subtitle?: string;
  statusCards: StatusCardData[];
  children: React.ReactNode;
}

const TABS = [
  { to: "/stock", label: "Products" },
  { to: "/stock/supplies", label: "Supplies" },
];

/**
 * Common shell for /stock and /stock/supplies — heading, tab bar, status cards.
 * Each tab supplies its own status cards (products vs supplies have different signals).
 */
export default function StockShell({ title, subtitle, statusCards, children }: StockShellProps) {
  const { pathname } = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <StatusCards cards={statusCards} />

      {children}
    </div>
  );
}

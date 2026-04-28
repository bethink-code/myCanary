import { Link } from "react-router-dom";

export type StatusSeverity = "critical" | "warning" | "ok" | "neutral";

export interface StatusCardData {
  label: string;
  value: number | string;
  caption: string;
  severity: StatusSeverity;
  to?: string;
}

const SEVERITY_COLORS: Record<StatusSeverity, string> = {
  critical: "text-red-700",
  warning: "text-amber-700",
  ok: "text-emerald-700",
  neutral: "text-slate-900",
};

export default function StatusCards({ cards }: { cards: StatusCardData[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => {
        const inner = (
          <div className="p-5 bg-white rounded-xl border border-border h-full">
            <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className={`mt-2 text-3xl font-semibold ${SEVERITY_COLORS[card.severity]}`}>
              {card.value}
            </div>
            <div className="mt-1 text-sm text-slate-500">{card.caption}</div>
          </div>
        );
        return card.to ? (
          <Link key={card.label} to={card.to} className="block hover:border-slate-300 transition-colors rounded-xl">
            {inner}
          </Link>
        ) : (
          <div key={card.label}>{inner}</div>
        );
      })}
    </div>
  );
}

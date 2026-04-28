import { Link } from "react-router-dom";

export type ChannelPill = "current" | "due" | "behind" | "none";

const PILL_CLASSES: Record<ChannelPill, string> = {
  current: "bg-emerald-100 text-emerald-700",
  due: "bg-amber-100 text-amber-700",
  behind: "bg-red-100 text-red-700",
  none: "bg-slate-100 text-slate-500",
};

const PILL_LABELS: Record<ChannelPill, string> = {
  current: "Up to date",
  due: "Action due",
  behind: "Behind",
  none: "No data",
};

interface Props {
  title: string;
  pill: ChannelPill;
  pillLabel?: string;
  caption: string;
  to: string;
  ctaLabel: string;
}

export default function ChannelCard({ title, pill, pillLabel, caption, to, ctaLabel }: Props) {
  return (
    <Link
      to={to}
      className="block p-5 bg-white rounded-xl border border-border hover:border-slate-300 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium text-slate-900">{title}</div>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PILL_CLASSES[pill]}`}>
          {pillLabel ?? PILL_LABELS[pill]}
        </span>
      </div>
      <div className="text-sm text-slate-500">{caption}</div>
      <div className="text-sm text-primary font-medium">{ctaLabel} →</div>
    </Link>
  );
}

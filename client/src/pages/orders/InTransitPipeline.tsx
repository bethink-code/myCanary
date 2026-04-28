import { Link } from "react-router-dom";
import { formatDateShort } from "../../lib/formatters";
import { groupPosByPipelineStatus, type PoSummary } from "../../../../shared/calculations/po";

interface Props {
  orders: PoSummary[];
}

const COLUMNS = [
  { key: "sent" as const, label: "Sent", emptyLabel: "Nothing sent" },
  { key: "confirmed" as const, label: "Confirmed by supplier", emptyLabel: "Nothing confirmed yet" },
  { key: "due" as const, label: "Due to arrive", emptyLabel: "Nothing arriving this week" },
];

export default function InTransitPipeline({ orders }: Props) {
  const groups = groupPosByPipelineStatus(orders);
  const total = groups.sent.length + groups.confirmed.length + groups.due.length;

  if (total === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">In transit</div>
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = groups[col.key];
          return (
            <div
              key={col.key}
              className="p-4 bg-white rounded-xl border border-border min-h-[120px]"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                {col.label}
              </div>
              {items.length === 0 ? (
                <div className="text-sm text-slate-400">{col.emptyLabel}</div>
              ) : (
                <div className="space-y-3">
                  {items.map((po) => (
                    <Link
                      key={po.id}
                      to={`/orders?expand=${po.id}`}
                      className="block px-3 py-2 rounded-lg border border-border hover:border-slate-300 transition-colors"
                    >
                      <div className="font-medium text-sm text-slate-900">
                        {po.manufacturerName ?? `PO-${po.id}`}
                      </div>
                      {po.skuSummary && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {po.skuSummary}
                        </div>
                      )}
                      {po.expectedDeliveryDate && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Expected {formatDateShort(po.expectedDeliveryDate)}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

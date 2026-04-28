import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { formatDateShort } from "../../lib/formatters";
import { invalidateStockData } from "../../lib/invalidation";
import ErrorBox from "../../components/ErrorBox";
import { useState } from "react";

interface POSummary {
  id: number;
  manufacturerName: string;
  status: string;
  createdDate: string;
  expectedDeliveryDate: string | null;
  lineCount: number;
  totalUnits: number;
}

interface POLine {
  id: number;
  skuCode: string;
  sizeVariant: string;
  quantityOrdered: number;
  triggerReason: string | null;
}

interface PODetail {
  id: number;
  manufacturerName: string;
  status: string;
  createdDate: string;
  approvedAt: string | null;
  sentAt: string | null;
  expectedDeliveryDate: string | null;
  notes: string | null;
  draftEmailBody: string | null;
  lines: POLine[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "Sent", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmed", className: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Delivered", className: "bg-green-100 text-green-700" },
};

const VALID_TRANSITIONS: Record<string, string> = {
  APPROVED: "SENT",
  SENT: "CONFIRMED",
  CONFIRMED: "DELIVERED",
};

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

export default function PoHistoryTable({ orders }: { orders: POSummary[] }) {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: detail, isLoading: detailLoading } = useQuery<PODetail>({
    queryKey: ["purchase-order", expandedId],
    queryFn: () => apiRequest(`/api/purchase-orders/${expandedId}`),
    enabled: expandedId !== null,
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/purchase-orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order", expandedId] });
      invalidateStockData(qc);
    },
  });

  const openOrders = orders.filter((o) => o.status !== "DELIVERED");
  const closedOrders = orders.filter((o) => o.status === "DELIVERED");

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <p className="text-slate-400 text-sm">
          No purchase orders yet. Use the Reorder workflow to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {advanceMutation.isError && (
        <ErrorBox>{(advanceMutation.error as Error).message}</ErrorBox>
      )}

      {openOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50">
            <h3 className="font-semibold text-sm text-slate-900">Open Orders ({openOrders.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Reference</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Manufacturer</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Created</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Expected Delivery</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Items</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Units</th>
                <th className="text-center px-5 py-2.5 font-medium text-slate-500 text-xs">Status</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {openOrders.map((po) => {
                const badge = STATUS_BADGES[po.status] ?? STATUS_BADGES.DRAFT;
                const nextStatus = VALID_TRANSITIONS[po.status];
                const isExpanded = expandedId === po.id;
                return (
                  <tr key={po.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : po.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        PO-{po.id}
                      </button>
                    </td>
                    <td className="px-5 py-3">{po.manufacturerName}</td>
                    <td className="px-5 py-3">{formatDateShort(po.createdDate)}</td>
                    <td className="px-5 py-3">
                      {po.expectedDeliveryDate ? (
                        <span>
                          {formatDateShort(po.expectedDeliveryDate)}
                          <span className="text-xs text-slate-400 ml-2">({daysUntil(po.expectedDeliveryDate)})</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{po.lineCount}</td>
                    <td className="px-5 py-3 text-right font-mono">{po.totalUnits}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {nextStatus && (
                        <button
                          onClick={() => advanceMutation.mutate({ id: po.id, status: nextStatus })}
                          disabled={advanceMutation.isPending}
                          className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          Mark {STATUS_BADGES[nextStatus]?.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {expandedId && detail && !detailLoading && (
            <div className="border-t border-border bg-slate-50/50 px-5 py-4 space-y-3">
              <div className="flex gap-6 text-xs text-slate-500">
                {detail.approvedAt && <span>Approved: {formatDateShort(detail.approvedAt)}</span>}
                {detail.sentAt && <span>Sent: {formatDateShort(detail.sentAt)}</span>}
                {detail.expectedDeliveryDate && <span>Expected: {formatDateShort(detail.expectedDeliveryDate)}</span>}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 font-medium text-slate-500 text-xs">SKU</th>
                    <th className="text-left py-1.5 font-medium text-slate-500 text-xs">Size</th>
                    <th className="text-right py-1.5 font-medium text-slate-500 text-xs">Qty Ordered</th>
                    <th className="text-left py-1.5 font-medium text-slate-500 text-xs">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {detail.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-1.5 font-mono text-xs">{line.skuCode}</td>
                      <td className="py-1.5">{line.sizeVariant}</td>
                      <td className="py-1.5 text-right font-mono">{line.quantityOrdered}</td>
                      <td className="py-1.5 text-slate-400 text-xs">{line.triggerReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.draftEmailBody && (
                <details className="text-xs">
                  <summary className="text-slate-400 cursor-pointer hover:text-slate-600">View email draft</summary>
                  <pre className="mt-2 bg-white rounded-lg border border-border p-3 text-slate-600 whitespace-pre-wrap font-mono text-xs">
                    {detail.draftEmailBody}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {closedOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50">
            <h3 className="font-semibold text-sm text-slate-900">Delivered ({closedOrders.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Reference</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Manufacturer</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Created</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Items</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Units</th>
                <th className="text-center px-5 py-2.5 font-medium text-slate-500 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {closedOrders.map((po) => (
                <tr key={po.id} className="text-slate-400">
                  <td className="px-5 py-3 font-medium">PO-{po.id}</td>
                  <td className="px-5 py-3">{po.manufacturerName}</td>
                  <td className="px-5 py-3">{formatDateShort(po.createdDate)}</td>
                  <td className="px-5 py-3 text-right font-mono">{po.lineCount}</td>
                  <td className="px-5 py-3 text-right font-mono">{po.totalUnits}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Delivered
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

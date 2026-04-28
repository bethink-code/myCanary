/**
 * Pure purchase order calculation functions.
 */

/** Calculate expected delivery date from send date + lead time. */
export function calcExpectedDeliveryDate(sentDate: Date, leadTimeDays: number): Date {
  const d = new Date(sentDate);
  d.setDate(d.getDate() + leadTimeDays);
  return d;
}

/** Days until expected delivery. Negative = overdue. */
export function calcDaysUntilDelivery(expectedDate: Date | string, today: Date = new Date()): number {
  const expected = typeof expectedDate === "string" ? new Date(expectedDate) : expectedDate;
  return Math.ceil((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Is this PO overdue? */
export function isPoOverdue(expectedDate: Date | string, today: Date = new Date()): boolean {
  return calcDaysUntilDelivery(expectedDate, today) < 0;
}

/** Valid PO status transitions. */
export const PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["SENT"],
  SENT: ["CONFIRMED"],
  CONFIRMED: ["DELIVERED"],
};

/** Check if a status transition is valid. */
export function isValidPoTransition(from: string, to: string): boolean {
  return PO_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface PoSummary {
  id: number;
  status: string;
  expectedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  manufacturerName?: string | null;
  skuSummary?: string | null;
}

export interface PoBuckets {
  open: number;
  dueThisWeek: number;
  deliveredThisMonth: number;
}

/** Aggregate POs into status counts for the Orders landing page. */
export function calcPoBuckets(orders: PoSummary[], today: Date = new Date()): PoBuckets {
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  let open = 0;
  let dueThisWeek = 0;
  let deliveredThisMonth = 0;

  for (const o of orders) {
    if (o.status !== "DELIVERED") {
      open++;
      if (o.expectedDeliveryDate) {
        const expected = new Date(o.expectedDeliveryDate);
        if (expected >= today && expected <= sevenDaysOut) {
          dueThisWeek++;
        }
      }
    } else if (o.deliveredAt) {
      const delivered = new Date(o.deliveredAt);
      if (delivered >= startOfMonth) deliveredThisMonth++;
    }
  }

  return { open, dueThisWeek, deliveredThisMonth };
}

export interface PipelineGroups {
  sent: PoSummary[];
  confirmed: PoSummary[];
  due: PoSummary[];
}

/**
 * Group open POs into pipeline columns for the IN TRANSIT view.
 * `due` includes any open PO with expectedDeliveryDate within 7 days,
 * regardless of SENT/CONFIRMED status — it's a "needs attention" lane.
 */
export function groupPosByPipelineStatus(
  orders: PoSummary[],
  today: Date = new Date(),
): PipelineGroups {
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const sent: PoSummary[] = [];
  const confirmed: PoSummary[] = [];
  const due: PoSummary[] = [];

  for (const o of orders) {
    if (o.status === "DELIVERED" || o.status === "DRAFT" || o.status === "APPROVED") continue;

    const isDueSoon =
      !!o.expectedDeliveryDate &&
      new Date(o.expectedDeliveryDate) <= sevenDaysOut;

    if (isDueSoon) {
      due.push(o);
    } else if (o.status === "CONFIRMED") {
      confirmed.push(o);
    } else if (o.status === "SENT") {
      sent.push(o);
    }
  }

  return { sent, confirmed, due };
}

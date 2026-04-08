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

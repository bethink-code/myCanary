/**
 * Tenant-scoped storage for unified stock movements.
 * Every insert includes clientId; audit log is written per movement.
 *
 * Neon HTTP driver has no transactions — calls are sequential. If a later
 * step fails, earlier writes remain. For deliveries this means: batch row
 * can exist without its stock row. Surface this in the route-level error.
 */

import { db } from "../db";
import { stockTransactions, supplyTransactions, batches } from "../../shared/schema";
import {
  movementToLedger,
  validateMovement,
  type MovementInput,
} from "../../shared/calculations/movements";

export interface RecordResult {
  batchId?: number;
  stockIds: number[];
  supplyIds: number[];
}

function periodFromDate(iso: string): { month: number; year: number } {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: m };
}

/**
 * Validate + persist a single movement. Throws on validation error.
 */
export async function recordMovement(
  clientId: number,
  userId: number,
  input: MovementInput,
): Promise<RecordResult> {
  const errors = validateMovement(input);
  if (errors.length) {
    throw Object.assign(new Error("Invalid movement"), { code: "INVALID_MOVEMENT", errors });
  }

  const effect = movementToLedger(input);
  const result: RecordResult = { stockIds: [], supplyIds: [] };

  // 1. Batch first (so stock rows can reference batchId)
  let batchId: number | null = null;
  if (effect.batchRow) {
    const [b] = await db
      .insert(batches)
      .values({
        clientId,
        skuCode: effect.batchRow.skuCode,
        sizeVariant: effect.batchRow.sizeVariant,
        stockLocation: effect.batchRow.stockLocation,
        batchNumber: effect.batchRow.batchNumber,
        manufactureDate: effect.batchRow.manufactureDate,
        expiryDate: effect.batchRow.expiryDate,
        initialQuantity: effect.batchRow.initialQuantity,
        receivedDate: effect.batchRow.receivedDate,
        deliveryNoteRef: effect.batchRow.deliveryNoteRef ?? null,
      })
      .returning({ id: batches.id });
    batchId = b.id;
    result.batchId = b.id;
  }

  // 2. Stock rows
  for (const row of effect.stockRows) {
    const { month, year } = periodFromDate(row.transactionDate);
    const [inserted] = await db
      .insert(stockTransactions)
      .values({
        clientId,
        batchId,
        skuCode: row.skuCode,
        stockLocation: row.stockLocation,
        transactionType: row.transactionType,
        quantity: row.quantity,
        transactionDate: row.transactionDate,
        periodMonth: month,
        periodYear: year,
        reference: row.reference ?? null,
        channel: row.channel ?? null,
        notes: row.notes ?? null,
        createdBy: userId,
      })
      .returning({ id: stockTransactions.id });
    result.stockIds.push(inserted.id);
  }

  // 3. Supply rows
  for (const row of effect.supplyRows) {
    const [inserted] = await db
      .insert(supplyTransactions)
      .values({
        clientId,
        supplyId: row.supplyId,
        transactionType: row.transactionType,
        quantity: row.quantity,
        transactionDate: row.transactionDate,
        manufacturerName: row.manufacturerName ?? null,
        reference: row.reference ?? null,
        notes: row.notes ?? null,
        relatedPoId: row.relatedPoId ?? null,
        createdBy: userId,
      })
      .returning({ id: supplyTransactions.id });
    result.supplyIds.push(inserted.id);
  }

  return result;
}

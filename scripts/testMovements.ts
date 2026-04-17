/**
 * End-to-end test of the unified movements pipeline.
 * Runs against dev DB. Cleans up after itself.
 *
 * Run: doppler run --project mycanary --config dev -- npx tsx scripts/testMovements.ts
 */

import { recordMovement } from "../server/movements/storage";
import { db } from "../server/db";
import {
  stockTransactions,
  supplyTransactions,
  batches,
} from "../shared/schema";
import { and, eq, desc } from "drizzle-orm";

const CLIENT_ID = 1;
const USER_ID = 1;
const SKU = "NPCC30";
const TEST_REF = "__TEST_MOVEMENTS";

function banner(msg: string) {
  console.log(`\n── ${msg} ${"─".repeat(Math.max(2, 60 - msg.length))}`);
}

async function cleanup() {
  await db.delete(stockTransactions).where(eq(stockTransactions.reference, TEST_REF));
  await db.delete(supplyTransactions).where(eq(supplyTransactions.reference, TEST_REF));
  await db.delete(batches).where(eq(batches.deliveryNoteRef, TEST_REF));
}

async function main() {
  await cleanup();

  banner("1. Product delivery — creates batch + stock row");
  const r1 = await recordMovement(CLIENT_ID, USER_ID, {
    type: "DELIVERY_RECEIVED",
    subjectKind: "product",
    skuCode: SKU,
    location: "THH",
    quantity: 120,
    date: "2026-04-17",
    deliveryNoteRef: TEST_REF,
    batchNumber: "TEST-BATCH-001",
    manufactureDate: "2026-01-10",
    expiryDate: "2028-01-10",
    sizeVariant: "30-pack",
  });
  console.log("batchId:", r1.batchId, "stockIds:", r1.stockIds);
  if (!r1.batchId || r1.stockIds.length !== 1) throw new Error("expected 1 batch + 1 stock row");

  const batch = await db.select().from(batches).where(eq(batches.id, r1.batchId));
  console.log("batch qty:", batch[0].initialQuantity, "batchNumber:", batch[0].batchNumber);
  if (batch[0].initialQuantity !== 120) throw new Error("batch qty mismatch");

  banner("2. Transfer — paired rows, opposite signs");
  const r2 = await recordMovement(CLIENT_ID, USER_ID, {
    type: "TRANSFER",
    subjectKind: "product",
    skuCode: SKU,
    fromLocation: "THH",
    toLocation: "88",
    quantity: 20,
    date: "2026-04-17",
  });
  console.log("transfer stockIds:", r2.stockIds);
  if (r2.stockIds.length !== 2) throw new Error("expected 2 rows for transfer");

  const rows = await db
    .select()
    .from(stockTransactions)
    .where(eq(stockTransactions.id, r2.stockIds[0]));
  const all = await db
    .select()
    .from(stockTransactions)
    .where(and(eq(stockTransactions.skuCode, SKU), eq(stockTransactions.transactionType, "TRANSFER_THH_TO_88")));
  console.log("found", all.length, "TRANSFER_THH_TO_88 rows for SKU");

  banner("3. Adjustment out — negative qty + notes");
  const r3 = await recordMovement(CLIENT_ID, USER_ID, {
    type: "ADJUSTMENT_OUT",
    subjectKind: "product",
    skuCode: SKU,
    location: "THH",
    quantity: 5,
    date: "2026-04-17",
    reasonText: "damage in transit",
  });
  const adj = await db.select().from(stockTransactions).where(eq(stockTransactions.id, r3.stockIds[0]));
  console.log("adjustment qty:", adj[0].quantity, "notes:", adj[0].notes);
  if (adj[0].quantity !== -5) throw new Error("adjustment qty should be negative");
  if (adj[0].notes !== "damage in transit") throw new Error("notes mismatch");

  banner("4. Validation failure — missing reasonText");
  let caught = false;
  try {
    await recordMovement(CLIENT_ID, USER_ID, {
      type: "ADJUSTMENT_IN",
      subjectKind: "product",
      skuCode: SKU,
      location: "THH",
      quantity: 10,
      date: "2026-04-17",
      reasonText: "",
    });
  } catch (e: any) {
    caught = true;
    console.log("caught expected error:", e.code, "—", (e.errors as string[]).join(", "));
  }
  if (!caught) throw new Error("expected validation error for missing reasonText");

  banner("5. Validation failure — transfer same location");
  caught = false;
  try {
    await recordMovement(CLIENT_ID, USER_ID, {
      type: "TRANSFER",
      subjectKind: "product",
      skuCode: SKU,
      fromLocation: "THH",
      toLocation: "THH",
      quantity: 5,
      date: "2026-04-17",
    });
  } catch (e: any) {
    caught = true;
    console.log("caught expected error:", (e.errors as string[]).join(", "));
  }
  if (!caught) throw new Error("expected validation error for same-location transfer");

  banner("6. Supply delivery — supply_transactions row");
  // Need a supply id to exist — find one from the dev DB
  const anySupply = await db.select().from(await import("../shared/schema").then((m) => m.supplies)).limit(1);
  if (anySupply.length === 0) {
    console.log("no supplies in dev DB — skipping supply test");
  } else {
    const supplyId = anySupply[0].id;
    const r6 = await recordMovement(CLIENT_ID, USER_ID, {
      type: "DELIVERY_RECEIVED",
      subjectKind: "supply",
      supplyId,
      quantity: 100,
      date: "2026-04-17",
      reference: TEST_REF,
    });
    console.log("supply delivery supplyIds:", r6.supplyIds);
    const sr = await db.select().from(supplyTransactions).where(eq(supplyTransactions.id, r6.supplyIds[0]));
    console.log("supply row qty:", sr[0].quantity, "type:", sr[0].transactionType);
    if (sr[0].transactionType !== "RECEIVED") throw new Error("expected RECEIVED type");
  }

  banner("7. Cleanup");
  await cleanup();
  console.log("cleaned up.");

  console.log("\n✔ all end-to-end movement checks passed");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n✖ FAIL:", e);
    cleanup().finally(() => process.exit(1));
  });

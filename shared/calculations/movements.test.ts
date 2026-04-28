import { test } from "node:test";
import assert from "node:assert/strict";
import {
  movementToLedger,
  validateMovement,
  type MovementInput,
} from "./movements.js";

// ─── Validation ───────────────────────────────────────────────

test("validate: rejects negative quantity", () => {
  const errs = validateMovement({
    type: "OPENING_BALANCE",
    subjectKind: "product",
    skuCode: "X",
    location: "THH",
    quantity: -1,
    date: "2026-04-17",
  });
  assert.ok(errs.some((e) => e.includes("positive")));
});

test("validate: rejects zero quantity", () => {
  const errs = validateMovement({
    type: "OPENING_BALANCE",
    subjectKind: "product",
    skuCode: "X",
    location: "THH",
    quantity: 0,
    date: "2026-04-17",
  });
  assert.ok(errs.length > 0);
});

test("validate: rejects bad date format", () => {
  const errs = validateMovement({
    type: "OPENING_BALANCE",
    subjectKind: "product",
    skuCode: "X",
    location: "THH",
    quantity: 10,
    date: "17/04/2026",
  });
  assert.ok(errs.some((e) => e.includes("yyyy-mm-dd")));
});

test("validate: adjustment requires reasonText (product)", () => {
  const errs = validateMovement({
    type: "ADJUSTMENT_IN",
    subjectKind: "product",
    skuCode: "X",
    location: "THH",
    quantity: 5,
    date: "2026-04-17",
    reasonText: "",
  });
  assert.ok(errs.some((e) => e.includes("reasonText")));
});

test("validate: adjustment requires reasonText (supply)", () => {
  const errs = validateMovement({
    type: "ADJUSTMENT_OUT",
    subjectKind: "supply",
    supplyId: 1,
    location: "THH",
    quantity: 5,
    date: "2026-04-17",
    reasonText: "",
  });
  assert.ok(errs.some((e) => e.includes("reasonText")));
});

test("validate: supply movement rejects unknown location", () => {
  const errs = validateMovement({
    type: "OPENING_BALANCE",
    subjectKind: "supply",
    supplyId: 1,
    location: "Mars" as never,
    quantity: 10,
    date: "2026-04-17",
  });
  assert.ok(errs.some((e) => e.includes("location")));
});

test("validate: supply transfer rejects same from and to", () => {
  const errs = validateMovement({
    type: "SUPPLY_TRANSFER",
    subjectKind: "supply",
    supplyId: 1,
    fromLocation: "THH",
    toLocation: "THH",
    quantity: 10,
    date: "2026-04-17",
  });
  assert.ok(errs.some((e) => e.includes("differ")));
});

test("validate: transfer requires different from and to", () => {
  const errs = validateMovement({
    type: "TRANSFER",
    subjectKind: "product",
    skuCode: "X",
    fromLocation: "THH",
    toLocation: "THH",
    quantity: 10,
    date: "2026-04-17",
  });
  assert.ok(errs.some((e) => e.includes("differ")));
});

test("validate: delivery requires batch fields", () => {
  const input: MovementInput = {
    type: "DELIVERY_RECEIVED",
    subjectKind: "product",
    skuCode: "X",
    location: "THH",
    quantity: 10,
    date: "2026-04-17",
    batchNumber: "",
    manufactureDate: "",
    expiryDate: "",
  };
  const errs = validateMovement(input);
  assert.ok(errs.some((e) => e.includes("batchNumber")));
  assert.ok(errs.some((e) => e.includes("manufactureDate")));
  assert.ok(errs.some((e) => e.includes("expiryDate")));
});

test("validate: happy path product delivery", () => {
  const errs = validateMovement({
    type: "DELIVERY_RECEIVED",
    subjectKind: "product",
    skuCode: "NPCC30",
    location: "THH",
    quantity: 100,
    date: "2026-04-17",
    batchNumber: "B001",
    manufactureDate: "2026-01-10",
    expiryDate: "2028-01-10",
    deliveryNoteRef: "DN-42",
  });
  assert.deepEqual(errs, []);
});

test("validate: happy path supply sent to manufacturer", () => {
  const errs = validateMovement({
    type: "SUPPLY_SENT_TO_MANUFACTURER",
    subjectKind: "supply",
    supplyId: 5,
    fromLocation: "THH",
    toLocation: "Zinchar",
    quantity: 10,
    date: "2026-04-17",
    manufacturerName: "Zinchar",
  });
  assert.deepEqual(errs, []);
});

// ─── Transformer ──────────────────────────────────────────────

test("transform: product opening balance -> single stock row", () => {
  const out = movementToLedger({
    type: "OPENING_BALANCE",
    subjectKind: "product",
    skuCode: "NPCC30",
    location: "THH",
    quantity: 50,
    date: "2026-04-17",
  });
  assert.equal(out.stockRows.length, 1);
  assert.equal(out.stockRows[0].transactionType, "OPENING_BALANCE");
  assert.equal(out.stockRows[0].quantity, 50);
  assert.equal(out.batchRow, null);
  assert.equal(out.supplyRows.length, 0);
});

test("transform: product delivery -> batch + stock row with DELIVERY_IN", () => {
  const out = movementToLedger({
    type: "DELIVERY_RECEIVED",
    subjectKind: "product",
    skuCode: "NPCC30",
    location: "THH",
    quantity: 100,
    date: "2026-04-17",
    batchNumber: "B001",
    manufactureDate: "2026-01-10",
    expiryDate: "2028-01-10",
    deliveryNoteRef: "DN-42",
  });
  assert.equal(out.stockRows.length, 1);
  assert.equal(out.stockRows[0].transactionType, "DELIVERY_IN");
  assert.equal(out.stockRows[0].quantity, 100);
  assert.equal(out.stockRows[0].reference, "DN-42");
  assert.ok(out.batchRow);
  assert.equal(out.batchRow!.batchNumber, "B001");
  assert.equal(out.batchRow!.deliveryNoteRef, "DN-42");
  assert.equal(out.batchRow!.initialQuantity, 100);
});

test("transform: adjustment down -> negative quantity + notes", () => {
  const out = movementToLedger({
    type: "ADJUSTMENT_OUT",
    subjectKind: "product",
    skuCode: "NPCC30",
    location: "THH",
    quantity: 7,
    date: "2026-04-17",
    reasonText: "damage in storage",
  });
  assert.equal(out.stockRows.length, 1);
  assert.equal(out.stockRows[0].transactionType, "ADJUSTMENT");
  assert.equal(out.stockRows[0].quantity, -7);
  assert.equal(out.stockRows[0].notes, "damage in storage");
});

test("transform: transfer -> paired rows, opposite signs, matching type", () => {
  const out = movementToLedger({
    type: "TRANSFER",
    subjectKind: "product",
    skuCode: "NPCC30",
    fromLocation: "THH",
    toLocation: "88",
    quantity: 20,
    date: "2026-04-17",
  });
  assert.equal(out.stockRows.length, 2);
  const from = out.stockRows.find((r) => r.stockLocation === "THH")!;
  const to = out.stockRows.find((r) => r.stockLocation === "88")!;
  assert.equal(from.quantity, -20);
  assert.equal(to.quantity, 20);
  assert.equal(from.transactionType, "TRANSFER_THH_TO_88");
  assert.equal(to.transactionType, "TRANSFER_THH_TO_88");
});

test("transform: sales out -> negative with invoice ref + channel", () => {
  const out = movementToLedger({
    type: "SALES_OUT",
    subjectKind: "product",
    skuCode: "NPCC30",
    location: "THH",
    quantity: 3,
    date: "2026-04-17",
    invoiceRef: "INV-99",
    channel: "D",
  });
  assert.equal(out.stockRows[0].quantity, -3);
  assert.equal(out.stockRows[0].transactionType, "SALES_OUT");
  assert.equal(out.stockRows[0].reference, "INV-99");
  assert.equal(out.stockRows[0].channel, "D");
});

test("transform: supply received -> positive RECEIVED row at location", () => {
  const out = movementToLedger({
    type: "DELIVERY_RECEIVED",
    subjectKind: "supply",
    supplyId: 5,
    location: "THH",
    quantity: 500,
    date: "2026-04-17",
    reference: "PO #42",
  });
  assert.equal(out.supplyRows.length, 1);
  assert.equal(out.supplyRows[0].transactionType, "RECEIVED");
  assert.equal(out.supplyRows[0].quantity, 500);
  assert.equal(out.supplyRows[0].location, "THH");
  assert.equal(out.supplyRows[0].reference, "PO #42");
  assert.equal(out.stockRows.length, 0);
});

test("transform: supply sent to manufacturer -> paired rows, opposite signs", () => {
  const out = movementToLedger({
    type: "SUPPLY_SENT_TO_MANUFACTURER",
    subjectKind: "supply",
    supplyId: 5,
    fromLocation: "THH",
    toLocation: "Zinchar",
    quantity: 200,
    date: "2026-04-17",
    manufacturerName: "Zinchar",
    relatedPoId: 77,
  });
  assert.equal(out.supplyRows.length, 2);
  const from = out.supplyRows.find((r) => r.location === "THH")!;
  const to = out.supplyRows.find((r) => r.location === "Zinchar")!;
  assert.equal(from.quantity, -200);
  assert.equal(to.quantity, 200);
  assert.equal(from.transactionType, "SENT_TO_MANUFACTURER");
  assert.equal(to.transactionType, "SENT_TO_MANUFACTURER");
  assert.equal(to.manufacturerName, "Zinchar");
  assert.equal(to.relatedPoId, 77);
});

test("transform: supply transfer -> paired rows, opposite signs, matching type", () => {
  const out = movementToLedger({
    type: "SUPPLY_TRANSFER",
    subjectKind: "supply",
    supplyId: 5,
    fromLocation: "Zinchar",
    toLocation: "NutriMed",
    quantity: 30,
    date: "2026-04-17",
  });
  assert.equal(out.supplyRows.length, 2);
  const from = out.supplyRows.find((r) => r.location === "Zinchar")!;
  const to = out.supplyRows.find((r) => r.location === "NutriMed")!;
  assert.equal(from.quantity, -30);
  assert.equal(to.quantity, 30);
  assert.equal(from.transactionType, "SUPPLY_TRANSFER_Zinchar_TO_NutriMed");
  assert.equal(to.transactionType, "SUPPLY_TRANSFER_Zinchar_TO_NutriMed");
});

test("transform: supply adjustment out -> ADJUSTMENT negative with notes at location", () => {
  const out = movementToLedger({
    type: "ADJUSTMENT_OUT",
    subjectKind: "supply",
    supplyId: 5,
    location: "Zinchar",
    quantity: 10,
    date: "2026-04-17",
    reasonText: "expired",
  });
  assert.equal(out.supplyRows[0].quantity, -10);
  assert.equal(out.supplyRows[0].transactionType, "ADJUSTMENT");
  assert.equal(out.supplyRows[0].location, "Zinchar");
  assert.equal(out.supplyRows[0].notes, "expired");
});

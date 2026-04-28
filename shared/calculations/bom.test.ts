import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcSupplyConsumption,
  bomToMatrixCells,
  packsPerBatch,
  perPackFromBatch,
  resolveBomPerPack,
  type BomLine,
} from "./bom.js";

test("calcSupplyConsumption: empty inputs return empty array", () => {
  assert.deepEqual(calcSupplyConsumption([], []), []);
  assert.deepEqual(calcSupplyConsumption([{ supplyId: 1, skuCode: "A", quantityPerUnit: 1 }], []), []);
  assert.deepEqual(calcSupplyConsumption([], [{ skuCode: "A", quantity: 100 }]), []);
});

test("calcSupplyConsumption: single supply, single SKU", () => {
  const bom: BomLine[] = [{ supplyId: 1, skuCode: "A", quantityPerUnit: 0.5 }];
  const out = calcSupplyConsumption(bom, [{ skuCode: "A", quantity: 100 }]);
  assert.deepEqual(out, [{ supplyId: 1, quantityNeeded: 50 }]);
});

test("calcSupplyConsumption: one supply across multiple SKUs sums correctly", () => {
  const bom: BomLine[] = [
    { supplyId: 1, skuCode: "A", quantityPerUnit: 0.5 },
    { supplyId: 1, skuCode: "B", quantityPerUnit: 1.0 },
  ];
  const out = calcSupplyConsumption(bom, [
    { skuCode: "A", quantity: 100 },
    { skuCode: "B", quantity: 200 },
  ]);
  // 100*0.5 + 200*1.0 = 250
  assert.deepEqual(out, [{ supplyId: 1, quantityNeeded: 250 }]);
});

test("calcSupplyConsumption: multiple supplies for one SKU", () => {
  const bom: BomLine[] = [
    { supplyId: 1, skuCode: "A", quantityPerUnit: 0.5 },
    { supplyId: 2, skuCode: "A", quantityPerUnit: 2 },
    { supplyId: 3, skuCode: "A", quantityPerUnit: 1 },
  ];
  const out = calcSupplyConsumption(bom, [{ skuCode: "A", quantity: 100 }]);
  assert.deepEqual(out, [
    { supplyId: 1, quantityNeeded: 50 },
    { supplyId: 2, quantityNeeded: 200 },
    { supplyId: 3, quantityNeeded: 100 },
  ]);
});

test("calcSupplyConsumption: ignores SKUs not in the production plan", () => {
  const bom: BomLine[] = [
    { supplyId: 1, skuCode: "A", quantityPerUnit: 1 },
    { supplyId: 2, skuCode: "Z", quantityPerUnit: 1 }, // not in plan
  ];
  const out = calcSupplyConsumption(bom, [{ skuCode: "A", quantity: 100 }]);
  assert.deepEqual(out, [{ supplyId: 1, quantityNeeded: 100 }]);
});

test("calcSupplyConsumption: duplicate plan lines for the same SKU are summed", () => {
  const bom: BomLine[] = [{ supplyId: 1, skuCode: "A", quantityPerUnit: 1 }];
  const out = calcSupplyConsumption(bom, [
    { skuCode: "A", quantity: 50 },
    { skuCode: "A", quantity: 50 },
  ]);
  assert.deepEqual(out, [{ supplyId: 1, quantityNeeded: 100 }]);
});

test("calcSupplyConsumption: fractional ratios produce fractional results", () => {
  const bom: BomLine[] = [{ supplyId: 1, skuCode: "A", quantityPerUnit: 0.0125 }];
  const out = calcSupplyConsumption(bom, [{ skuCode: "A", quantity: 80 }]);
  assert.equal(out[0].quantityNeeded, 1);
});

test("bomToMatrixCells: passes through with renamed fields", () => {
  const bom: BomLine[] = [
    { supplyId: 1, skuCode: "A", quantityPerUnit: 0.5 },
    { supplyId: 2, skuCode: "B", quantityPerUnit: 2 },
  ];
  const cells = bomToMatrixCells(bom);
  assert.equal(cells.length, 2);
  assert.equal(cells[0].quantityPerUnit, 0.5);
});

// ─── batch-size conversion ──────────────────────────────────

test("packsPerBatch: tablets-based product (chews 30 pack, batch 50000)", () => {
  const ppb = packsPerBatch({
    batchSizeMinimum: 50000,
    batchSizeUnit: "tablets",
    packSizeUnits: 30,
    packSizeG: null,
  });
  assert.ok(ppb != null);
  assert.ok(Math.abs(ppb! - 1666.6667) < 0.01);
});

test("packsPerBatch: kg-based product (formula 500g, batch 20kg)", () => {
  const ppb = packsPerBatch({
    batchSizeMinimum: 20,
    batchSizeUnit: "kg",
    packSizeUnits: null,
    packSizeG: 500,
  });
  assert.equal(ppb, 40);
});

test("packsPerBatch: units-based product (spray 200ml = 1 unit, batch 1000)", () => {
  const ppb = packsPerBatch({
    batchSizeMinimum: 1000,
    batchSizeUnit: "units",
    packSizeUnits: 1,
    packSizeG: 200,
  });
  assert.equal(ppb, 1000);
});

test("packsPerBatch: returns null when batch info missing", () => {
  const ppb = packsPerBatch({
    batchSizeMinimum: null,
    batchSizeUnit: "tablets",
    packSizeUnits: 30,
    packSizeG: null,
  });
  assert.equal(ppb, null);
});

test("packsPerBatch: returns null on unit mismatch (kg batch but no packSizeG)", () => {
  const ppb = packsPerBatch({
    batchSizeMinimum: 20,
    batchSizeUnit: "kg",
    packSizeUnits: 30, // wrong field for kg-based
    packSizeG: null,
  });
  assert.equal(ppb, null);
});

test("perPackFromBatch: Allergy Care chews — 20.005 kg Kelp per 50000-tab batch → ~0.012 kg per 30-pack", () => {
  const perPack = perPackFromBatch(20.005, {
    batchSizeMinimum: 50000,
    batchSizeUnit: "tablets",
    packSizeUnits: 30,
    packSizeG: null,
  });
  assert.ok(perPack != null);
  assert.ok(Math.abs(perPack! - 0.012003) < 0.0001);
});

test("resolveBomPerPack: per_unit row passes through unchanged", () => {
  const out = resolveBomPerPack(
    { quantityPerUnit: 1, quantityBasis: "per_unit" },
    { batchSizeMinimum: 50000, batchSizeUnit: "tablets", packSizeUnits: 30, packSizeG: null },
  );
  assert.equal(out, 1);
});

test("resolveBomPerPack: per_batch row converts using product info", () => {
  const out = resolveBomPerPack(
    { quantityPerUnit: 20.005, quantityBasis: "per_batch" },
    { batchSizeMinimum: 50000, batchSizeUnit: "tablets", packSizeUnits: 30, packSizeG: null },
  );
  assert.ok(out != null);
  assert.ok(Math.abs(out! - 0.012003) < 0.0001);
});

test("resolveBomPerPack: per_batch returns null when product missing batch info", () => {
  const out = resolveBomPerPack(
    { quantityPerUnit: 20, quantityBasis: "per_batch" },
    { batchSizeMinimum: null, batchSizeUnit: null, packSizeUnits: null, packSizeG: null },
  );
  assert.equal(out, null);
});

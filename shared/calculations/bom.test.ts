import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSupplyConsumption, bomToMatrixCells, type BomLine } from "./bom.js";

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

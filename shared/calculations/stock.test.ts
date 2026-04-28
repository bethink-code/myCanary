import { test } from "node:test";
import assert from "node:assert/strict";
import { calcStockHealthBuckets } from "./stock.js";

test("calcStockHealthBuckets: empty array returns zeros", () => {
  const out = calcStockHealthBuckets([]);
  assert.deepEqual(out, { reorder: 0, approaching: 0, healthy: 0, total: 0 });
});

test("calcStockHealthBuckets: items without reorderPoint excluded from buckets but counted in total", () => {
  const out = calcStockHealthBuckets([
    { currentStock: 10, reorderPoint: null },
    { currentStock: 10, reorderPoint: 0 },
  ]);
  assert.deepEqual(out, { reorder: 0, approaching: 0, healthy: 0, total: 2 });
});

test("calcStockHealthBuckets: classifies reorder, approaching, healthy", () => {
  const out = calcStockHealthBuckets([
    { currentStock: 5, reorderPoint: 10 }, // REORDER (5 <= 10)
    { currentStock: 10, reorderPoint: 10 }, // REORDER (10 <= 10)
    { currentStock: 11, reorderPoint: 10 }, // APPROACHING (11 <= 12.5)
    { currentStock: 13, reorderPoint: 10 }, // OK
    { currentStock: 100, reorderPoint: 10 }, // OK
  ]);
  assert.equal(out.reorder, 2);
  assert.equal(out.approaching, 1);
  assert.equal(out.healthy, 2);
  assert.equal(out.total, 5);
});

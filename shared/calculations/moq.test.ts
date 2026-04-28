import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMoqRules,
  applyBundlingRules,
  checkOrderFrequency,
  type BundlingRule,
} from "./moq.js";

// ─── applyMoqRules ───────────────────────────────────────────

test("applyMoqRules: empty context returns the desired qty unchanged", () => {
  const out = applyMoqRules(50, {});
  assert.equal(out.adjustedQty, 50);
  assert.deepEqual(out.reasons, []);
});

test("applyMoqRules: raises to per-product min order qty", () => {
  const out = applyMoqRules(20, {
    product: { caseRoundingRequired: false, unitsPerCase: null, minOrderQty: 50 },
  });
  assert.equal(out.adjustedQty, 50);
  assert.ok(out.reasons[0].includes("MOQ 50"));
});

test("applyMoqRules: respects qty already above MOQ", () => {
  const out = applyMoqRules(100, {
    product: { caseRoundingRequired: false, unitsPerCase: null, minOrderQty: 50 },
  });
  assert.equal(out.adjustedQty, 100);
  assert.deepEqual(out.reasons, []);
});

test("applyMoqRules: case rounding rounds up to nearest case size", () => {
  const out = applyMoqRules(20, {
    product: { caseRoundingRequired: true, unitsPerCase: 12, minOrderQty: null },
  });
  assert.equal(out.adjustedQty, 24); // 20 → ceil(20/12)*12 = 24
  assert.ok(out.reasons.some((r) => r.includes("12")));
});

test("applyMoqRules: combined MOQ + case rounding", () => {
  const out = applyMoqRules(10, {
    product: { caseRoundingRequired: true, unitsPerCase: 12, minOrderQty: 24 },
  });
  // First MOQ raises 10 → 24, then case rounding of 24 (already a multiple of 12) stays 24
  assert.equal(out.adjustedQty, 24);
  assert.ok(out.reasons.some((r) => r.includes("MOQ 24")));
  // Case rounding shouldn't re-fire on something already aligned
  assert.equal(out.reasons.filter((r) => r.includes("rounded up")).length, 0);
});

test("applyMoqRules: supply MOQ via moqStructured", () => {
  const out = applyMoqRules(50, {
    supply: { moqStructured: 100, caseRoundingRequired: false, unitsPerCase: null },
  });
  assert.equal(out.adjustedQty, 100);
});

test("applyMoqRules: case rounding requires unitsPerCase > 1 to fire", () => {
  const out = applyMoqRules(7, {
    product: { caseRoundingRequired: true, unitsPerCase: 1, minOrderQty: null },
  });
  assert.equal(out.adjustedQty, 7);
});

// ─── applyBundlingRules ──────────────────────────────────────

test("applyBundlingRules: adds bundled SKU when absent", () => {
  const rules: BundlingRule[] = [
    { primarySkuCode: "ACC30", bundledSkuCode: "ACC30-LABEL", ratio: 1 },
  ];
  const out = applyBundlingRules([{ skuCode: "ACC30", quantity: 100 }], rules);
  assert.equal(out.length, 2);
  const bundled = out.find((l) => l.skuCode === "ACC30-LABEL")!;
  assert.equal(bundled.quantity, 100);
  assert.ok(bundled.reason?.includes("bundled with ACC30"));
});

test("applyBundlingRules: leaves bundled SKU alone when already at sufficient qty", () => {
  const rules: BundlingRule[] = [
    { primarySkuCode: "ACC30", bundledSkuCode: "ACC30-LABEL", ratio: 1 },
  ];
  const out = applyBundlingRules(
    [
      { skuCode: "ACC30", quantity: 100 },
      { skuCode: "ACC30-LABEL", quantity: 200 },
    ],
    rules,
  );
  const bundled = out.find((l) => l.skuCode === "ACC30-LABEL")!;
  assert.equal(bundled.quantity, 200);
  assert.equal(bundled.reason, undefined);
});

test("applyBundlingRules: raises bundled SKU when below required ratio", () => {
  const rules: BundlingRule[] = [
    { primarySkuCode: "ACC30", bundledSkuCode: "ACC30-LABEL", ratio: 1 },
  ];
  const out = applyBundlingRules(
    [
      { skuCode: "ACC30", quantity: 100 },
      { skuCode: "ACC30-LABEL", quantity: 50 },
    ],
    rules,
  );
  const bundled = out.find((l) => l.skuCode === "ACC30-LABEL")!;
  assert.equal(bundled.quantity, 100);
  assert.ok(bundled.reason?.includes("raised to bundle"));
});

test("applyBundlingRules: ratio < 1 (bundle is half the primary)", () => {
  const rules: BundlingRule[] = [
    { primarySkuCode: "A", bundledSkuCode: "B", ratio: 0.5 },
  ];
  const out = applyBundlingRules([{ skuCode: "A", quantity: 100 }], rules);
  const bundled = out.find((l) => l.skuCode === "B")!;
  assert.equal(bundled.quantity, 50);
});

test("applyBundlingRules: skips rule when primary not in draft", () => {
  const rules: BundlingRule[] = [
    { primarySkuCode: "ACC30", bundledSkuCode: "ACC30-LABEL", ratio: 1 },
  ];
  const out = applyBundlingRules([{ skuCode: "OTHER", quantity: 100 }], rules);
  assert.equal(out.length, 1);
  assert.equal(out[0].skuCode, "OTHER");
});

// ─── checkOrderFrequency ─────────────────────────────────────

test("checkOrderFrequency: allowed when no cap", () => {
  const out = checkOrderFrequency("2026-04-20", { orderFrequencyCapDays: null }, new Date("2026-04-28"));
  assert.equal(out.allowed, true);
  assert.equal(out.daysUntilAllowed, 0);
});

test("checkOrderFrequency: allowed when no prior PO", () => {
  const out = checkOrderFrequency(null, { orderFrequencyCapDays: 60 }, new Date("2026-04-28"));
  assert.equal(out.allowed, true);
});

test("checkOrderFrequency: blocked when within cap window", () => {
  const out = checkOrderFrequency(
    "2026-04-20",
    { orderFrequencyCapDays: 30 },
    new Date("2026-04-28"),
  );
  assert.equal(out.allowed, false);
  assert.equal(out.daysUntilAllowed, 22); // 30 - 8 days since
});

test("checkOrderFrequency: allowed once cap window has passed", () => {
  const out = checkOrderFrequency(
    "2026-01-01",
    { orderFrequencyCapDays: 30 },
    new Date("2026-04-28"),
  );
  assert.equal(out.allowed, true);
});

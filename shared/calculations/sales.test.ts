import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSalesBuckets, calcChannelStatus } from "./sales.js";

const today = new Date("2026-04-28");

test("calcSalesBuckets: empty inputs return zeros", () => {
  const out = calcSalesBuckets([], [], today);
  assert.deepEqual(out, { unitsSoldThisMonth: 0, pnpDispatchesThisMonth: 0 });
});

test("calcSalesBuckets: counts only this-month entries", () => {
  const orders = [
    { units: 10, createdAt: "2026-04-15" }, // this month
    { units: 5, createdAt: "2026-04-01" }, // this month (boundary)
    { units: 3, createdAt: "2026-03-31" }, // last month
    { units: 7, createdAt: "2026-05-01" }, // next month
  ];
  const pnpRuns = [
    { createdAt: "2026-04-10" },
    { createdAt: "2026-04-20" },
    { createdAt: "2026-03-25" },
  ];
  const out = calcSalesBuckets(orders, pnpRuns, today);
  assert.equal(out.unitsSoldThisMonth, 15);
  assert.equal(out.pnpDispatchesThisMonth, 2);
});

test("calcChannelStatus: no-data when never active", () => {
  const out = calcChannelStatus({ lastActivityAt: null, dueAfterDays: 7 }, today);
  assert.equal(out, "no-data");
});

test("calcChannelStatus: current within window", () => {
  const out = calcChannelStatus({ lastActivityAt: "2026-04-25", dueAfterDays: 7 }, today);
  assert.equal(out, "current");
});

test("calcChannelStatus: due past dueAfter", () => {
  const out = calcChannelStatus({ lastActivityAt: "2026-04-15", dueAfterDays: 7 }, today);
  assert.equal(out, "due");
});

test("calcChannelStatus: behind past behindAfter", () => {
  const out = calcChannelStatus(
    { lastActivityAt: "2026-04-01", dueAfterDays: 7, behindAfterDays: 21 },
    today,
  );
  assert.equal(out, "behind");
});

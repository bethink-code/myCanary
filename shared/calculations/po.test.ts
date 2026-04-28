import { test } from "node:test";
import assert from "node:assert/strict";
import { calcPoBuckets, groupPosByPipelineStatus, type PoSummary } from "./po.js";

const today = new Date("2026-04-28");

test("calcPoBuckets: empty input", () => {
  const out = calcPoBuckets([], today);
  assert.deepEqual(out, { open: 0, dueThisWeek: 0, deliveredThisMonth: 0 });
});

test("calcPoBuckets: counts open, due-this-week, and delivered-this-month", () => {
  const orders: PoSummary[] = [
    { id: 1, status: "SENT", expectedDeliveryDate: "2026-05-01" }, // open + due this week
    { id: 2, status: "CONFIRMED", expectedDeliveryDate: "2026-05-30" }, // open, not due
    { id: 3, status: "DRAFT" }, // open
    { id: 4, status: "DELIVERED", deliveredAt: "2026-04-15" }, // delivered this month
    { id: 5, status: "DELIVERED", deliveredAt: "2026-03-31" }, // delivered last month
    { id: 6, status: "SENT", expectedDeliveryDate: "2026-04-29" }, // open + due tomorrow
  ];
  const out = calcPoBuckets(orders, today);
  assert.equal(out.open, 4); // 1, 2, 3, 6
  assert.equal(out.dueThisWeek, 2); // 1, 6
  assert.equal(out.deliveredThisMonth, 1); // 4
});

test("groupPosByPipelineStatus: sorts open POs into sent/confirmed/due lanes", () => {
  const orders: PoSummary[] = [
    { id: 1, status: "SENT", expectedDeliveryDate: "2026-06-01" }, // sent (not soon)
    { id: 2, status: "CONFIRMED", expectedDeliveryDate: "2026-06-15" }, // confirmed (not soon)
    { id: 3, status: "SENT", expectedDeliveryDate: "2026-04-30" }, // due (within 7d)
    { id: 4, status: "CONFIRMED", expectedDeliveryDate: "2026-05-03" }, // due (within 7d)
    { id: 5, status: "DRAFT" }, // ignored (not in pipeline)
    { id: 6, status: "DELIVERED" }, // ignored
  ];
  const out = groupPosByPipelineStatus(orders, today);
  assert.deepEqual(out.sent.map((o) => o.id), [1]);
  assert.deepEqual(out.confirmed.map((o) => o.id), [2]);
  assert.deepEqual(out.due.map((o) => o.id).sort(), [3, 4]);
});

test("groupPosByPipelineStatus: PO without expectedDeliveryDate stays in its status lane", () => {
  const orders: PoSummary[] = [
    { id: 1, status: "SENT" },
    { id: 2, status: "CONFIRMED" },
  ];
  const out = groupPosByPipelineStatus(orders, today);
  assert.deepEqual(out.sent.map((o) => o.id), [1]);
  assert.deepEqual(out.confirmed.map((o) => o.id), [2]);
  assert.deepEqual(out.due, []);
});

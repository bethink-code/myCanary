# Supplies module — intent and consolidation direction

Beryl's framing during the 2026-04-28 PO automation design session:

> "It's not only the relationships, it's also the levels of supplies that
> are important. Feels like a supplies module with the logic built in."

In other words: supplies tracking, BOM relationships, MOQ rules, and
supply levels per location are interrelated and should live as one
coherent module rather than scattered across Stock, Settings, and
Tools.

## Current state (post-foundations 1-3)

- **Levels by location** — location-aware ledger on `supply_transactions`
  (THH / Zinchar / NutriMed)
- **BOM relationships** — `supplyProductMappings` table with three UI
  surfaces (per-supply, per-product, Settings matrix)
- **MOQ rules** — typed columns on supplies/manufacturers + a small
  bundling rules table

## Open consolidation question

The three foundations were intentionally implemented across the existing
nav (Supplies under Stock, BOM Matrix and MOQ Rules under Settings) to
keep the work shippable. But the underlying intent is one workspace.

When the user is ready (likely after PO automation lands), consider:
- A single "Supplies" top-level nav item that bundles Levels, BOM,
  MOQ Rules, and Imports under one roof.
- Or: a "Supply Planning" workspace that surfaces all four side by side
  for a single supply (its levels, what products use it, its MOQ, its
  recent movements).

This is a UX consolidation, not a data refactor — the schema is already
right.

## How to apply

Don't pre-emptively consolidate. Wait until the user feels the pain of
context-switching between Settings → BOM and Stock → Supplies, then
revisit this note and propose a consolidation.

# Supplies module — intent and consolidation direction

Beryl's framing during the 2026-04-28 PO automation design session:

> "It's not only the relationships, it's also the levels of supplies that
> are important. Feels like a supplies module with the logic built in."

In other words: supplies tracking, BOM relationships, MOQ rules, and
supply levels per location are interrelated and should live as one
coherent module rather than scattered across Stock, Settings, and
Tools.

## Current state (foundations F1–F5 shipped 2026-04-28)

- **Levels by location (F1)** — `supply_transactions.location` column
  (THH / Zinchar / NutriMed). RecordMovementModal location-aware with
  three-pill direction toggle (in / out / adjustment). Supplies page
  shows per-location columns + a Total.
- **BOM relationships (F2)** — `supplyProductMappings` active with
  `numeric(12,4) quantity_per_unit` and unique index. Three UI surfaces:
  Settings → BOM Matrix bulk grid, Supplies "Used in" pill list on
  expanded row, ProductDetail "Bill of materials" table.
- **MOQ rules (F3)** — typed columns on products, supplies, manufacturers
  + a small `moq_bundling_rules` table ("when ordering A, bundle B at
  ratio R"). Settings → MOQ Rules tab manages bundling. Free-text fields
  (`manufacturers.moqNotes`, `supplies.moq`) kept alongside as colour.
- **Manufacturer batch minimum + per-batch BOM (F4)** — Beryl's data
  shape says raw materials are tracked per batch (20.005 kg Kelp per
  50,000-tablet Allergy Care batch), not per pack. Schema additions:
  `products.batchSizeMinimum` + `batchSizeUnit` (tablets/units/kg) +
  `packSizeUnits`, and `supply_product_mappings.quantityBasis` (per_unit
  default | per_batch). Conversion helper `resolveBomPerPack` divides
  by `packsPerBatch(product)` at draft time. Per-batch entries get an
  amber `/batch` indicator in the matrix.
- **Brand/range split (F5)** — `brand` field was muddling ownership
  with product line. Now: `brand` = ownership (THH or NP), new `range`
  column = product line (HH = Herbal Horse mixes, HP = Herbal Pet
  chews/formulas/sprays/gravy, NP = Nutriphase). Both selectable in
  the Product edit modal. Migration script
  (`scripts/migrateBrandRange.ts`, idempotent) backfilled both DBs.

## Pure calc layer ready for PO drafting

`shared/calculations/`:
- `stock.ts` — calcRecommendedOrderQty, calcStockHealthBuckets
- `po.ts` — calcPoBuckets, groupPosByPipelineStatus
- `moq.ts` — applyMoqRules, applyBundlingRules, checkOrderFrequency
- `bom.ts` — calcSupplyConsumption, packsPerBatch, perPackFromBatch,
  resolveBomPerPack
- `sales.ts` — calcSalesBuckets, calcChannelStatus

73+ unit tests covering all of the above.

## Beryl's setup guide

`docs/beryl-setup-guide.md` — step-by-step procedure for populating the
data PO automation needs (manufacturers, products, supplies, BOM matrix,
MOQ bundling rules), with a smoke test, the per_unit/per_batch mapping
from her Animal Farm sheet, and the front+back-label gotcha.

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

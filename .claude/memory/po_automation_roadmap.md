# PO automation roadmap

Three pieces of work confirmed by Garth in the 2026-04-28 design session.
Foundations (supplies location ledger, BOM matrix, structured MOQ rules)
all shipped to prod 2026-04-28. Next: thorough prod testing of the
foundations, then this work.

## 1. PO drafting from MOQ + BOM + reorder calc

The system composes a draft purchase order when reorder-point trips fire
or when Beryl explicitly asks for one. The draft applies, in order:
- Reorder calc (`shared/calculations/stock.ts → calcRecommendedOrderQty`)
- MOQ rounding (`shared/calculations/moq.ts → applyMoqRules`)
- Bundling (`shared/calculations/moq.ts → applyBundlingRules`)
- Manufacturer min-order-value and order-frequency cap checks

The draft routes to Beryl for approval. **Critical principle: 100%
human-in-the-loop. The system never sends a PO autonomously.** Status
flows DRAFT → APPROVED → SENT, all driven by explicit Beryl actions.

## 2. Xero PO sync

Beryl currently creates and sends POs manually inside Xero. Target:
when a draft is approved and status flips to SENT, mirror to Xero so
stock-on-the-water is visible there alongside Xero's existing supplier
contact and PO format rules.

Schema work: add `purchaseOrders.xeroPurchaseOrderId varchar(50)` FK.
Wiring: reuse existing Xero auth in `server/xeroAuth.ts`. The Xero PO
becomes the canonical send mechanism — MyCanary owns drafting, Xero owns
delivery and supplier-contact rules.

## 3. After-send supplies check

Beryl currently has the manual habit of, after sending a PO for finished
products, walking through related raw materials and packaging to decide
whether to order more. Automate that prompt:

- On PO status → SENT, emit `PO_SENT` event through the centralised
  notifications module (per `architecture.md`).
- The supplies module subscribes; resolves the SKUs on the PO through the
  BOM matrix (`shared/calculations/bom.ts → calcSupplyConsumption`) to
  derive required supplies.
- Beryl gets a prompt: "PO #N sent for SKUs A, B, C. Related supplies
  to review: [list with current stock per location, projected need]."
- She reviews and triggers further supply ordering as needed (manual
  decision; system surfaces the data).

## How to apply

Foundations are shipped — confirm Beryl has populated the BOM Matrix
(Settings → BOM Matrix) and the structured MOQ fields on
products/manufacturers/supplies + the bundling rules (Settings → MOQ
Rules) before drafting can produce useful output. Likely slicing order:
drafting first, Xero sync second, after-send check third.

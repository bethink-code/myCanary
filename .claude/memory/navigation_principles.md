# Navigation principles (post-2026-04-28 rearrangement)

The MyCanary navigation is built from one organising principle: **stock
moves**. It comes in, sits still, goes out. Every section in the app
maps to one of those three motions or supports them.

## Six top-level sections, no dropdowns

| Section | Purpose |
|---------|---------|
| Dashboard | The canary's reading — status across all sections, what needs attention today |
| Stock | What you have — current levels, transfers, adjustments. Supplies as a sub-view |
| Orders | Stock coming in — reorder, manufacturer POs, delivery receipt |
| Sales | Stock going out — Xero direct, PnP weekly, customer orders |
| Settings | System configuration — products, manufacturers, integrations, setup imports |
| Admin | Platform infrastructure — users, access, audit (unchanged) |

No dropdowns. Everything is one click. Sub-navigation lives inside
section landings (e.g. Products | Supplies tabs at the top of `/stock`)
via `PageTabs`-style link bars, not the top nav.

## Section pattern (every operational section follows this)

1. **Status cards first** — three numbers that summarise the situation
   in this section's domain. Critical / warning / healthy buckets.
2. **Tracking (where applicable)** — pipeline view for in-flight things.
   Orders has the IN TRANSIT pipeline (SENT / CONFIRMED / DUE TO ARRIVE).
3. **Actions / data** — the workflows and the filterable table below.

User arrives knowing the situation, then chooses what to do.
Tracking is never a separate section — it lives at the top of the
section it belongs to.

## Why customer orders live under Sales

Customer orders are stock leaving the business by a sales channel,
alongside Xero direct sales and PnP weekly dispatch. Putting them under
"Orders" alongside manufacturer POs would conflate "stock coming in"
with "stock going out" — exactly the confusion the rearrangement
removes. Old `/orders` (customer orders) → `/sales/customer-orders`.

## Why Tools menu was retired

Tools was a catch-all for things that did not have a clear home. The
new structure gives everything a clear home:
- Opening Balance Import + Supply Import → Settings (configuration /
  one-time setup)
- Stock Adjustment + Stock Transfer → Stock Quick Actions
  (operational actions that change where stock sits, not whether it
  exists)

There is no replacement for Tools as a concept.

## Working-rhythm prompts surface in context

If a PnP dispatch is due, the prompt appears in Sales — not only on the
Dashboard. Context-aware nudges surface where the action will be taken.
The Dashboard remains a status surface that never duplicates information
that lives in the operational sections; it just summarises and links.

## How to apply

When designing any new feature or page:
- Decide which of the three motions it serves (in / sits / out) — that
  picks the section.
- If it doesn't fit one of the three, it probably belongs in Settings.
- A page that needs both a status summary and a data table follows the
  pattern: status cards → tracking → actions/table.
- Never re-introduce the Tools-style catch-all. Every new feature has a
  clear home in one of the six sections.

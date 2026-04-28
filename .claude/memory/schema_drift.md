# Schema drift between dev and prd is a recurring risk

`shared/schema.ts` is the single Drizzle source of truth, but `db:push` is run
against dev first and prd lags until an explicit deploy step. This means the
schema declared in code can diverge from what prd actually has — sometimes
for days.

**Why this matters:** A query that compiles fine and works in dev will throw
"column does not exist" against prd if the column was added to the schema but
the prd push hasn't happened yet. On serverless this can take down a route
on first import.

## How to apply

- Before writing prod SQL or scripts that touch a recently-added column,
  verify the column exists in prd (`doppler run --config prd -- ...`).
- When debugging a "column does not exist" error against prd, suspect schema
  drift before code bugs.
- When merging schema changes, treat `db:push` against prd as part of the
  release, not an afterthought. CLAUDE.md says so explicitly under
  Deployment.

## Past instances (resolved)

- 2026-04-13: a `users.role` drift was suspected. Re-verification on
  2026-04-28 found `role` actually lives on `user_clients` (not `users`),
  and is present on both dev and prd. The original memory note misnamed
  the table.
- 2026-04-28: dev had a "Slice A: Order planning" leftover —
  `production_batches`, `order_plans`, `order_plan_lines` tables and
  `products.production_batch_id`, `products.units_per_moq`,
  `manufacturers.moq_unit/min/step` columns. None of them present in
  schema.ts or referenced in code. Cleaned up via manual SQL before
  pushing the F1 + PR2 additive changes.
- 2026-04-28: a stale `sessions` table (plural, declared in schema.ts but
  unused) coexisted with `session` (singular, the active connect-pg-simple
  table). Removed the schema.ts declaration, dropped the empty `sessions`
  on both DBs, kept `tablesFilter: ["!session"]` so connect-pg-simple's
  table stays out of Drizzle's purview.

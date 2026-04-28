# MyCanary — Project Memory

Long-term notes for Claude Code. Loaded into every session via root `CLAUDE.md`.

Add new entries as `memory/<topic>.md` and link them below as
`- [Title](<topic>.md) — one-line hook`.

## Entries

- [Doppler — secrets and DBs](doppler.md) — Doppler configs and how to run code against dev/prd
- [Schema drift between dev and prd](schema_drift.md) — `db:push` lags on prd; verify columns before prod scripts
- [Architectural principles beyond CLAUDE.md](architecture.md) — centralised notifications + recalc-on-edit
- [PO automation roadmap](po_automation_roadmap.md) — drafting / Xero sync / after-send supplies check; foundations F1-F5 shipped, ready to build once Beryl populates
- [Supplies module intent](supplies_module_intent.md) — current state of supplies + BOM + MOQ + locations + brand/range; pure calc layer ready
- [Navigation principles](navigation_principles.md) — six-section "stock moves" model, section pattern, why Tools is retired
- [Data-model decisions](data_model_decisions.md) — brand vs range, per_unit vs per_batch BOM basis, batch-size minimums, supply locations, why free-text + structured fields coexist

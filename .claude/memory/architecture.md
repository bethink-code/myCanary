# MyCanary architectural principles (beyond CLAUDE.md)

Two principles Garth has stated with teeth that aren't in CLAUDE.md and have
shaped past design sessions. Apply when designing new features, not just
when implementing.

## 1. Centralised notifications and communications

Features emit events; they do not send. The notifications module owns
recipients, channels, templates, and delivery.

```
feature → notifications.emit(type, payload) → [notifications module]
                                                ↓
                                           email / slack / in-app / ...
```

Adding a new channel (e.g. Slack) is a change inside the notifications
module only. No feature route writes a notification row, sends an email, or
posts to a webhook directly.

**Why:** keeps feature handlers simple, makes "who gets told what" auditable
in one place, and stops every new feature from re-deciding delivery rules.

## 2. Edits trigger recalculation, not blind overrides

When a human adjusts something mid-plan (order planning, price lists, anything
with downstream implications), the edit is stored as a **constraint** and the
full calculation re-runs with that constraint pinned.

- Pure calc functions are re-runnable on every edit.
- PATCH endpoints recalculate and return a diff; they don't just write
  raw values.
- The default behaviour for a calculated field's PATCH is "re-run the calc
  with this pinned" not "update the stored value".

**Why:** UIs that let users change one field and silently miss the knock-on
effects (sibling SKU splits, MOQ rounding, supply consumption) are the
specific failure mode this guards against. Confirmed in the order-planning
design session, 2026-04-17.

## How to apply

- When designing a new feature that touches multiple concerns, lead with
  the module boundaries before writing code.
- When adding a PATCH on a calculated field, default to re-run-the-calc.
- When tempted to inline notification / email / Xero logic in a route,
  stop and route through the dedicated module.

# MyCanary data-model decisions (non-obvious from code alone)

These are design decisions confirmed in the 2026-04-28 sessions with
Garth + grounded in Beryl's actual data shape (Animal Farm production
sheet). Future Claude sessions should respect these when extending the
schema or building features that touch products / supplies / BOM / PO.

## brand vs range (F5)

`products.brand` and `products.range` are deliberately separate:

- **`brand` = ownership.** Who owns/sells the product. Currently `THH`
  (The Herbal Horse) or `NP` (Nutriphase).
- **`range` = product line.** Which sub-family within an owner's lineup.
  `HH` (Herbal Horse — mixes for horses), `HP` (Herbal Pet — chews,
  formulas, sprays, gravy, shampoo for pets), `NP` (Nutriphase).

A THH-owned product can be in either the HH or HP range. NP products are
brand=NP, range=NP. Beryl's spreadsheet uses these range labels as her
"Brand variation" column — her mental model maps to range, not brand.

**Don't conflate them.** If a future feature needs "all THH stuff",
filter by `brand = THH`. If it needs "all chews/formulas", filter by
`range = HP`.

## BOM basis: per_unit vs per_batch (F4)

`supply_product_mappings.quantityBasis` exists because Beryl tracks raw
materials per **manufacturer batch**, not per finished pack:

- **per_unit** (default) — how many of this supply per ONE finished pack.
  Use for packaging (jars, seals, labels, cases at 1/12 ratio etc.).
- **per_batch** — how many for ONE manufacturer batch run. Use for raw
  materials (e.g. 20.005 kg of Kelp per 50,000-tablet Allergy Care
  batch). Auto-converts to per-pack at PO drafting time using
  `resolveBomPerPack(row, product)` which divides by `packsPerBatch`.

The matrix UI shows an amber `/batch` indicator on per_batch cells so
Beryl can see at a glance which entries the system will convert.

**When extending PO drafting:** always go through `resolveBomPerPack` —
never read `quantityPerUnit` directly. If conversion returns null
(missing `batchSizeMinimum` or unit-mismatch), surface a warning rather
than silently treating it as zero or per-pack.

## Manufacturer batch minimum (F4)

`products.batchSizeMinimum` + `batchSizeUnit` (`tablets` | `units` | `kg`)
+ `packSizeUnits` capture the smallest run a manufacturer will produce.
Examples:

- Zinchar chews: batchSizeMinimum=50000, batchSizeUnit=tablets,
  packSizeUnits=30 (or 150 for the bulk packs)
- Nutrimed formulas: batchSizeMinimum=20, batchSizeUnit=kg,
  packSizeUnits=null (uses existing `packSizeG` instead)
- Sprays: batchSizeMinimum=1000, batchSizeUnit=units, packSizeUnits=1

PO drafting must respect these — can't draft 100 chews if Zinchar's
floor is 50,000 tablets. The drafter rounds up to the next batch
multiple, or flags the request.

## Supply locations (F1)

`supply_transactions.location` has three valid values: `THH`, `Zinchar`,
`NutriMed`. Stock balance per location = sum of transactions filtered
by location. Two-row writes (TRANSFER variants) move stock between
locations atomically:

- `SUPPLY_TRANSFER` — generic THH↔Zinchar/NutriMed move
- `SUPPLY_SENT_TO_MANUFACTURER` — directed (from must be THH-side, to
  is the manufacturer location)

Direct supplier→manufacturer (skipping THH) is supported by recording
opening balance directly at the manufacturer location.

## Free-text + structured fields coexist

Multiple places have both:

- `manufacturers.moqNotes` (free) + structured `minOrderValueZar` +
  `orderFrequencyCapDays`
- `supplies.moq` (free) + structured `moqStructured` + `moqUnit` +
  `unitsPerCase` + `caseRoundingRequired`

The free-text fields are deliberate — they capture operational colour
(e.g. "ships in cases of 12 from Hong Kong, allow 8 weeks") that the
structured fields can't express. Don't drop them. Calc layer uses
structured fields; UI shows both side by side.

## How to apply

Schema-touching changes that involve products, supplies, BOM, or PO
should re-read this note before adding fields. Specifically:
- Don't put range info in the `brand` field
- Don't add per-batch quantities to a per_unit BOM cell — use the basis
  toggle
- Don't lose `moqNotes` / `supplies.moq` text — they pair with the
  structured fields

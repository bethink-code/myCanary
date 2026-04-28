# MyCanary — Setup & Testing Guide for Beryl

## Before you start

- URL: **mycanary.biz**
- Total time: 3-5 hours; works fine in chunks across multiple sessions
- Have your Animal Farm production sheet open as a reference
- The system **logs every change** with before/after values, so don't worry about experimenting — anything wrong can be seen and reverted
- Save happens per item; nothing is "lost" if you stop mid-way

---

## Part 1 — Quick smoke test (15 min)

Confirms the new system works before you spend hours entering data.

### 1.1 Dashboard loads

- Land on **mycanary.biz** → should redirect to `/dashboard`
- ✅ Three status cards (Stock / Orders / Sales) with real numbers
- ✅ Greeting line at top
- 🚩 If you see "Setup Journey" instead — click "Skip for now" top-right

### 1.2 Section navigation

Click each top-nav item and confirm it loads:

| Click | What you should see |
|---|---|
| **Dashboard** | 3 status cards |
| **Stock** | Products tab + status cards (Reorder/Approaching/Healthy) + table |
| **Stock → Supplies** sub-tab | Supplies table with **per-location columns** (THH / Zinchar / NutriMed / Total) |
| **Orders** | Status cards + In-Transit pipeline + PO history |
| **Sales** | 3 status cards + 3 channel cards (Xero / PnP / Customer Orders) |
| **Settings** | Tabs: Products & SKUs, Manufacturers, BOM Matrix, MOQ Rules, System Settings, Opening Balance Import, Supply Import |

🚩 **If any page errors out** → screenshot the URL + error → send to Garth.

### 1.3 Record a movement (test the location ledger)

- **Stock → Supplies** → expand any supply (click the row)
- Click "Record movement"
- Direction: **+ Stock in** → Reason: Opening balance → **Location: Zinchar** → quantity 10 → Save
- ✅ Modal closes; expanding the supply again shows location columns updated

If all green, proceed.

---

## Part 2 — Setup procedure (~3-5 hours total)

Work in this order. Earlier steps unblock later ones.

### Step 1 — Manufacturers (5 min)

**Settings → Manufacturers → Edit each (Zinchar + Nutrimed)**

Fill in:

- **Lead time (days)** — typical days from PO sent to delivery
- **Min order value (ZAR)** — leave blank if no minimum
- **Order frequency cap (days)** — leave blank if no cap (e.g. 60 = max 1 PO every 2 months)
- **MOQ Notes** — free-text, anything not captured above

✅ **Success check:** click Edit again — values persist.

---

### Step 2 — Products: batch info + MOQ (45-60 min)

**Settings → Products & SKUs → Edit each (~46 products)**

For each product, look for the **Manufacturer batch** section. Fill in based on type:

| Product type | Batch min | Batch unit | Pack size (units) |
|---|---|---|---|
| Chews 30-pack (e.g. ACC30) | 50000 | tablets | 30 |
| Chews 150-pack (e.g. CCH150) | 50000 | tablets | 150 |
| Formulas 200g (e.g. AF200G) | 20 | kg | *leave blank* |
| Formulas 500g (e.g. AF500G) | 20 | kg | *leave blank* |
| Mixes 500g | 20 | kg | *leave blank* |
| Mixes 2kg | 20 | kg | *leave blank* |
| Sprays 200ml | 1000 | units | 1 |
| Omega 3 75g | 20 | kg | *leave blank* |
| Collagen Gravy | 20 | kg | *leave blank* |

**Why this matters:** without batch info, PO automation can't convert "20 kg of Kelp per batch" into "0.012 kg per pack" — it'll skip those raw-material lines and warn you.

Also set if applicable:

- **Min order qty (packs)** — only if there's a per-SKU minimum
- **Round PO qty up to nearest case** — toggle on if you always order in whole cases

✅ **Success check:** edit one product again — Manufacturer batch values still there.

---

### Step 3 — Add missing size-specific supplies (15-30 min)

Some packaging variants aren't in the system yet. Compare your sheet to **Stock → Supplies** — likely missing:

- **500g jars** for Allergy/Joint/Serenity Formulas (system has 200g jars only)
- **150-tab jars** for HP Calming and HP Tick & Flea bulk
- Any other size-specific item your sheet implies

For each: **Stock → Supplies → New supply**:

- Name: descriptive (e.g. "HP Calming chews 150 jar — Cores 53mm x 130mm")
- Category: PACKAGING
- Unit of measure: usually "each" or blank
- Save. You'll fill in MOQ/reorder fields in Step 4.

---

### Step 4 — Edit existing supplies (1-2 hr)

**Stock → Supplies → click "Edit" on each (~80 supplies)**

The edit modal has 5 sections:

- **Identity** — name, category, subcategory, unit of measure
- **Supplier** — name, contact, price, lead time (free text)
- **Stock planning** — **Reorder point** ⭐ critical for PO automation
- **MOQ rules** — Min order qty, Units per case, Round up to case toggle
- **Notes**

Most important fields for PO automation:

- **Reorder point** — quantity at or below which you'd reorder
- **Lead time** — how long to wait
- **MOQ structured** — the numeric minimum (e.g. labels come in rolls of 1000)
- **Units per case** + **Round up** — if supplier ships in fixed cases

Do this in chunks across sessions. The status pills on the supplies page start showing meaningful "needs reorder / OK" once reorder points are set.

---

### Step 5 — BOM Matrix (1-2 hr) — the critical one

**Settings → BOM Matrix**

Grid: supplies down the left, SKU codes across the top. **Click any cell** to open the edit modal.

The modal has a **Basis** toggle (this is new — read carefully):

| Basis | What you enter | Use for |
|---|---|---|
| **Per finished pack** *(default)* | Quantity for ONE finished pack of this SKU | All packaging items (jars, seals, labels, bottles, caps, triggers, cases) |
| **Per manufacturer batch** | Quantity for ONE manufacturer batch run | Raw materials from your sheet's "Quantity per batch" column (Kelp 20.005 kg, Omega 3 powder 2.5 kg, Phytoplankton 2 kg, Cedarwood oil 8.4 kg) |

**Per-batch entries show a small amber `/batch` suffix in the matrix.** That's the system saying "I'll convert this at PO drafting time using the product's batch min."

#### Mapping from your sheet to the matrix

For each row in your Animal Farm sheet:

| Sheet column | Matrix entry |
|---|---|
| "Cardboard jars for HP X" qty **1** | per_unit, qty **1** |
| "54mm seals" / "75mm seal" qty **1** | per_unit, qty **1** |
| "Vitamin bottle 125ml white" qty **1** | per_unit, qty **1** |
| "Tablet cap 38mm black with seal" qty **1** | per_unit, qty **1** |
| "Mini trigger all plastic" qty **1** | per_unit, qty **1** |
| "Case for X" qty **1/12** | per_unit, qty **0.0833** |
| "Case for 200g HP" qty **1/6** | per_unit, qty **0.1667** |
| "Kelp 20.005 kg" (per batch) | **per_batch**, qty **20.005** |
| "Omega 3 powder 2.5 kg" (per batch) | **per_batch**, qty **2.5** |
| "Phytoplankton 2 kg" (per batch) | **per_batch**, qty **2** |
| "Cedarwood oil 8.4 kg" (per batch) | **per_batch**, qty **8.4** |

#### ⚠️ Front + back labels are TWO supplies

Your sheet says "Label for Farriers mix 500g qty 1" — but the system splits this into:

- "Farriers' Mix front label" (one common front label across pack sizes)
- "Farriers' Mix 500g back label" (size-specific)

So that's **two BOM rows per pack size**, both at qty 1. Same pattern for formulas (front + back).

#### Tip for speed

Group your work by supply, not by SKU:

1. Do all jar entries first (one cell per HP/HH SKU that uses each jar)
2. Then seals (54mm vs 75mm)
3. Then labels (front first, then size-specific backs)
4. Then cases (1/6 or 1/12)
5. Finally raw materials (the 4 per_batch entries — quick)

✅ **Success check:** open any product detail (Stock → click a product) → "Bill of materials" section shows everything you mapped.

---

### Step 6 — MOQ Bundling Rules (10 min, only if applicable)

**Settings → MOQ Rules → New rule**

Only add rules where you genuinely have an "always order A and B together" constraint. Most products won't need any. Examples:

- "When ordering ACC30, always include ACC30 labels at 1:1"

For each rule:

- Manufacturer (or "Any manufacturer")
- Primary SKU
- Bundled SKU
- Ratio (1.0 = always 1:1)

---

## Part 3 — Verify everything's right (15 min)

Spot-check after Step 5:

1. **Open a product detail** (Stock → click any SKU). Confirm:
   - "Bill of materials" section lists all supplies
   - Both front + back labels appear if you mapped them
2. **Open a supply** (Stock → Supplies → expand row). Confirm:
   - "Used in" pill list shows the SKUs it feeds
   - Per-location columns are accurate (mostly THH if you haven't moved any to Zinchar/NutriMed)
3. **BOM Matrix scan** — cells populated where they should be; per-batch entries have the `/batch` suffix.
4. **Audit log** (Settings → Admin → Audit, if you have admin access) — recent changes show your edits with before/after values.

---

## Part 4 — What to flag to Garth

Send a message if:

- ❗ Crashes / red error messages — screenshot URL + error
- ❗ A supply you need is missing and "New supply" doesn't fit
- ❗ Pack sizes don't match your sheet
- ❗ Anything auto-changes without you doing it — shouldn't happen
- ❗ You can't figure out where to enter something

Don't worry about:

- Per-location columns being "—" until you record movements at Zinchar/NutriMed
- Setup Journey banner — "Skip for now" is fine
- Old URLs in browser bookmarks — they redirect

---

## Part 5 — When you're done

Tell Garth. Next phase: PO automation will use everything you've set up to **draft purchase orders for your approval**. The system computes recommended quantities from reorder points, applies your MOQ rules, derives the supply consumption from your BOM, and routes the draft to you. **You stay 100% in control** — nothing gets sent without your explicit approval.

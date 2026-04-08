# THH Operations App — UX Snapshot

**Date:** 8 April 2026
**Purpose:** Capture the current user experience for anyone evaluating the app from a usability perspective — not a technical document.

---

## 1. What This App Does

The Herbal Horse & Pet (THH) is a South African natural supplement manufacturer. They sell their own THH brand directly and through wholesalers, and also produce Nutriphase (NP) products sold exclusively through Pick n Pay.

Until now, all stock tracking, reordering, and order processing has been done manually in Excel spreadsheets. This app replaces those spreadsheets with a live system that covers three core workflows:

1. **Stock management** — Know what's in stock, what's running low, and what needs reordering
2. **Order fulfilment** — Process customer orders from receipt through to courier dispatch
3. **PnP weekly dispatch** — Handle Pick n Pay's weekly orders to the 8/8 courier warehouse

The app manages stock across **two physical locations** (THH premises and the 8/8 courier warehouse) and tracks orders to **two manufacturers** (Zinchar and Nutrimed), both with ~5-week lead times.

---

## 2. Who Uses It

- **Beryl Shuttleworth** (business owner, admin) — primary user, manages all operations
- **Team members** — view stock levels, process orders (non-admin access)
- **Future users** — can request access via a self-service form on the login page

---

## 3. Getting In

**Login:** Users sign in with their Google account. There's no username/password to remember.

**First-time experience:**
- If you've been invited by an admin, you sign in and immediately see a terms acceptance screen. You must acknowledge that data is confidential and actions are logged before proceeding.
- If you haven't been invited, you can submit an access request (name, email, optional phone number) and wait for admin approval.

**What's missing:** There's no guided onboarding, tour, or "getting started" checklist. A new user lands on the dashboard and needs to figure things out from context.

---

## 4. Navigation

The app uses a **horizontal navigation bar** across the top:

| Menu Item | Who Sees It | What It Does |
|-----------|-------------|--------------|
| Dashboard | Everyone | Home page with quick actions and stock health |
| Stock Levels | Everyone | View all products and current stock |
| Orders | Everyone | Customer order list |
| PnP Weekly | Everyone | Pick n Pay dispatch workflow |
| Stock Out: Xero | Admins only | Import sales data from Xero |
| Settings | Admins only | Product config, manufacturer info, integrations |

**Also in the header:** A notification bell (top-right) showing unread alerts, and a sign-out link.

**Hidden pages** (accessible but not in the navigation bar):
- Record a manufacturer delivery (Stock In)
- Import opening balances (one-time setup)
- Admin console (user management, audit logs)

**What's missing:** No breadcrumbs. If you're deep in a product detail or order, there's a "Back" link but no trail showing where you are in the app hierarchy. Some important admin pages have no navigation link at all — you'd only find them through buttons on other pages.

---

## 5. Dashboard — The Home Page

When you log in, you see:

**A personalised greeting** — "Welcome back, Beryl"

**Three quick-action cards:**
- **Run Stock Check** — see what needs reordering (neutral styling)
- **Stock In: Record Delivery** — log a manufacturer shipment (green border)
- **Stock Out: Import Sales** — pull sales data from Xero (red border)

The green/red colour coding immediately tells you whether an action adds or removes inventory.

**Stock Health widget** — a traffic-light summary:
- **Green (OK):** products with healthy stock levels
- **Amber (Approaching):** products getting close to reorder point
- **Red (Reorder):** products that need to be reordered now

**Alerts widget** — currently a placeholder showing "No alerts at this time." This space is reserved for future use.

---

## 6. Stock Levels — The Main Inventory View

This is the core page. At the top, two coloured panels group all stock actions:

**Green panel — Stock In (adding inventory):**
- Import Opening Balances (one-time from the Animal Farm spreadsheet)
- Record Manufacturer Delivery (ongoing, from Zinchar or Nutrimed)

**Red panel — Stock Out (removing inventory):**
- Import Sales from Xero (deducts sold quantities from THH stock)
- PnP Dispatch to 8/8 (deducts from the warehouse)
- Transfer THH → 8/8 (moves stock between locations — shown in amber)

Below the action panels, there's a **filter bar** with:
- Text search (by product name or SKU code)
- Category dropdown (e.g., Horse Mix, Pet Formula)
- Location filter (THH or 8/8)
- Status filter (Reorder, Approaching, OK)

The **stock table** shows each product with:
- Product name and SKU code
- THH on-hand quantity (shown as units and cases)
- 8/8 on-hand quantity
- Reorder point
- Status badge (red/amber/green)
- Manufacturer name (shows "TBC" in amber if not yet assigned)

**An educational note** at the top explains: "On Hand = Deliveries received minus Sales recorded." This helps users understand that stock levels are calculated from transaction history, not manually entered.

Clicking any product name opens its detail page.

---

## 7. Product Detail — Deep Dive on a Single Product

Shows everything about one product across several sections:

**Summary cards** at the top:
- THH On Hand
- 8/8 On Hand
- Reorder Point
- Manufacturer

**Product details:** Pack size, units per case, primary location, Xero item code, and any notes.

**Active batches table:** Shows current stock lots with batch numbers, manufactured/expiry dates, and quantities. Batches expiring within 6 months are highlighted in amber as a visual warning.

**Transaction history:** The last 50 stock movements, each labelled clearly:
- "Stock In: Delivery" — green
- "Stock Out: Sales" — red
- "Stock Out: PnP Dispatch" — red
- "Transfer: THH to 8/8" — amber
- "Adjustment" — neutral

Every row shows the quantity change in green (positive) or red (negative), with the location, channel, reference, and notes. This is the complete audit trail for the product.

---

## 8. Reorder Workflow — Deciding What to Order

This page answers: "What do we need to order, and from whom?"

**If all stock is healthy:** A green card with a checkmark says "All stock levels OK."

**If products need attention:** They're grouped by manufacturer (e.g., "ZINCHAR ORDER", "NUTRIMED ORDER"), with a table showing:
- Product name and SKU
- Current stock vs. reorder point
- Status badge (red or amber)
- An **editable order quantity** field (pre-filled with a recommended amount)
- A **checkbox** to include/exclude each product from the purchase order

When products are checked, an **email draft** appears below — a ready-to-send purchase order addressed to the manufacturer, listing items, quantities, and a requested delivery date (40 days out). The user clicks "Approve & Copy PO" to copy it to their clipboard and paste it into their email client.

**This is a Phase 1 workflow** — the app generates the content, but the human sends the email manually. This is intentional: the app never makes autonomous decisions.

---

## 9. Stock Transfer — Moving Between Locations

A simple form for moving stock from THH premises to the 8/8 warehouse.

1. Select a product from a dropdown (shows current stock at both locations)
2. Enter the number of cases to transfer
3. See the calculated unit count and a warning if you're trying to transfer more than is available
4. Submit

On success, a green confirmation message appears with the exact quantities moved.

The page has an amber info banner at the top: "Transfers move stock between locations — Stock Out at THH, Stock In at 8/8." This reinforces the directional language.

---

## 10. Delivery Receipt — Recording Incoming Stock

A multi-line form for logging manufacturer deliveries (Stock In).

**Header fields:**
- Delivery note reference (e.g., "DN 3127")
- Date received (defaults to today)
- Location (THH or 8/8)

**Line items** (add as many as needed):
- Product (dropdown)
- Size variant (e.g., "500g")
- Batch number
- Manufactured date
- Expiry date
- Quantity

A green callout at the top explains: "Recording a delivery creates Stock In transactions — adding to on-hand inventory."

---

## 11. Opening Balance — First-Time Stock Setup

A **three-step wizard** for importing initial stock levels from the Animal Farm spreadsheet:

**Step 1 — Choose source:**
- Pull live from the Google Sheets version of Animal Farm, or
- Upload an Excel file manually

**Step 2 — Preview:**
- Shows a table of every product found in the spreadsheet
- Each row is marked "Matched" (green) if it maps to a product in the system, or "Unmatched" (red) if not
- Summary counts show matches, mismatches, and total units
- The user reviews and confirms the import

**Step 3 — Done:**
- Success confirmation with a count of transactions created
- Links to view stock levels or return to the dashboard

---

## 12. Xero Sales Import — Recording What Was Sold

A **three-step wizard** for importing sales data from Xero (Stock Out).

**Step 1 — Choose source and period:**
- Pull directly from the Xero API (if connected), or upload an Excel export
- Quick-select buttons for the last 12 months make date selection easy
- A history table shows past imports so the user knows what's already been processed
- If re-importing a period, a warning explains that no stock changes happen until confirmation

**Step 2 — Preview and mapping:**
- Shows every line item from the sales report
- Each row is colour-coded:
  - **Green "Mapped"** — recognised product, will be deducted from stock
  - **Grey "Skipped (PnP)"** — PnP channel sales that don't affect THH stock (handled separately)
  - **Red "Unknown SKU"** — product not found in the system
- PnP rows are visually dimmed so the user can focus on what matters

**Step 3 — Done:**
- Confirmation of how many stock transactions were created
- Link back to stock management

**The loading overlay** is especially important here — pulling data from Xero can take 30–60 seconds, and the overlay shows a message explaining the wait.

---

## 13. Orders — Customer Order Management

**Order list page:**
- Table showing all orders with date, reference, customer, channel, item count, and status
- Filters for status and sales channel
- "New Order" button to create one manually

**Order status progression** — visualised as a timeline with four stages:
1. **Received** (blue) — order logged
2. **Confirmed** (amber) — availability checked
3. **Invoiced** (purple) — Xero invoice created
4. **Dispatched** (green) — shipped to customer

Each stage is shown as a numbered circle; completed stages get a checkmark. The current stage is highlighted with a ring effect.

**Order detail page** — organised into tabs:
- **Order Details:** Customer info, delivery address, line items, and a button to advance to the next status
- **Stock Check:** Shows ordered vs. available quantities, with shortfalls highlighted in red
- **Invoice:** Xero reference field and a "Copy to Clipboard" button for line items (formatted for pasting into Xero)
- **Courier:** Booking details with a copy button, courier service selector, and waybill number field
- **Summary:** Read-only overview of the entire order

**What's missing:** No save-as-draft for new orders — if you navigate away mid-entry, your work is lost. The order creation form is a single long page rather than a guided flow.

---

## 14. PnP Weekly — Pick n Pay Dispatch

The most structured workflow in the app — a **five-step wizard**:

**Step 1 — Upload:**
- Drag-and-drop zone for the PnP Excel file
- Enter the week-ending date and appointment time
- Parse the file to extract order lines

**Step 2 — Review:**
- Table showing every product PnP ordered, mapped to system SKUs
- Matched products shown with green badges; unmatched shown in red with a dropdown to manually assign a SKU
- Summary counts of matched vs. unmatched items

**Step 3 — Stock Check:**
- Compares ordered quantities against available 8/8 warehouse stock
- Shows shortfalls in red; if everything is available, a green success banner appears
- User decides whether to proceed with available stock

**Step 4 — Dispatch Instruction:**
- Pre-generated email with subject line and formatted body (monospace font for readability)
- Editable text area so the user can adjust before sending
- Xero invoice reference field
- "Copy to Clipboard" button + "Approve & Mark Dispatched" to finalise

**Step 5 — Complete:**
- Green success card with checkmark
- Count of stock transactions created
- If any products are now low, a **low stock alert** box (amber) lists the affected SKUs
- Buttons to go back to the dashboard or process another week

A **step indicator bar** at the top shows progress through all five stages with numbered circles and checkmarks.

---

## 15. Settings

Three tabs:

**Products & SKUs:**
- Searchable table of all products
- Click "Edit" to open a modal where you can update manufacturer assignment, reorder point override, Xero item code, and notes
- Products without a manufacturer show an amber "TBC" badge

**Manufacturers:**
- Read-only table showing name, email, contact person, and lead times

**System Settings:**
- Xero connection status (connect/disconnect)
- Gmail and Courier integrations show "Phase 1" badges — these are manual copy-paste workflows for now, with API automation planned for Phase 2

---

## 16. Admin Console

Five tabs (admin-only):

- **Users:** List of all system users with admin status
- **Invites:** Send email invitations to new users
- **Access Requests:** Review and action self-service access requests
- **Audit Log:** Timestamped log of every action taken in the system (who did what, when)
- **Security:** Summary cards showing total users, admin count, and system health status

---

## 17. Visual Language & Patterns

**Colour system (used consistently throughout):**
- **Green** = Stock In, healthy, success, positive quantities
- **Red** = Stock Out, critical, errors, negative quantities
- **Amber** = Approaching threshold, warnings, transfers, items needing attention
- **Blue** = Informational, received status, Xero-related actions
- **Purple** = Invoiced status
- **Grey** = Inactive, skipped, placeholder

**Status badges:** Small rounded pills with coloured backgrounds — used for stock status, order status, match status during imports, and notification types.

**Multi-step wizards:** Used for the three most complex processes (Opening Balance, Xero Import, PnP Weekly). Each shows a step indicator at the top and moves through: input → preview → confirm → done.

**Preview-before-commit:** Every data import shows a preview table where the user reviews what will happen before confirming. Nothing changes until you explicitly approve.

**Copy-to-clipboard:** Purchase orders, invoice data, courier bookings, and dispatch instructions all generate formatted text that the user copies and pastes into email or Xero. This is the deliberate Phase 1 approach.

**Loading overlay:** A full-screen overlay with spinner, message, and sub-message. Used during any operation that takes more than a moment (especially Xero API calls which can take 30–60 seconds).

**Tables:** Clean design with light grey headers, hover effects on rows, right-aligned numbers in monospace font, and footer counts.

---

## 18. What's Working Well

- **Stock In/Out clarity** — the green/red colour coding and explicit labelling ("Stock In: Delivery", "Stock Out: Sales") makes the direction of every operation unmistakable
- **Wizard flows** — the step-by-step approach for imports and dispatch breaks complex processes into manageable decisions
- **Preview before commit** — users always see exactly what will happen before data changes
- **Traffic-light stock health** — dashboard and stock table give immediate at-a-glance status
- **Copy-to-clipboard as a feature** — rather than pretending automation exists, the app honestly generates content for manual workflows
- **Audit trail** — every stock movement is recorded with type, channel, and reference — full transparency
- **Batch and expiry tracking** — expiring batches are visually flagged in amber

---

## 19. UX Gaps & Opportunities

**Navigation & discoverability:**
- No breadcrumbs — users navigating between stock levels, product detail, and reorder can lose their place
- Several important admin pages (delivery receipt, opening balance, admin console) have no navigation link — they're only reachable through buttons on other pages
- The horizontal nav bar may not scale well on mobile or if more menu items are added

**Onboarding:**
- No first-time user guidance, tooltips, or "getting started" flow
- New users must learn the Stock In/Out mental model on their own
- The educational note on the Stock Levels page helps, but appears only there

**Dashboard:**
- The Alerts widget is a placeholder — this is prime real estate that could surface actionable information (expiring batches, pending orders, recent imports)
- No recent activity feed to show what's happened

**Data entry:**
- Order creation is a single long form with no save-as-draft — risky for complex orders
- No inline validation during entry (errors shown after submission)

**Product identity:**
- No visual distinction between THH and NP (Nutriphase) brand products in tables — important because they follow different supply chains
- Category filtering exists but brand filtering does not

**Settings:**
- Two of three system setting cards show "Coming soon" — feels unfinished
- Manufacturer details are read-only with no way to update from the UI

**Mobile experience:**
- The app is responsive (tables scroll horizontally, grids collapse to single column) but hasn't been optimised for touch or small screens
- The horizontal navigation bar may overflow on narrow devices

**Workflow gaps:**
- No way to track a purchase order after the email is copied — the PO exists in the system but there's no "awaiting delivery" status or expected delivery date tracking
- No connection between a purchase order sent and a delivery received — these are separate workflows with no linking

---

## 20. User Journeys at a Glance

**Daily check-in:**
> Dashboard → Stock Health widget → see red/amber counts → click through to Stock Levels → filter by status → review individual products

**Monthly sales import:**
> Dashboard → Stock Out: Import Sales → choose Xero API or file → select month → preview mapped items → confirm → stock levels updated

**Reordering:**
> Stock Levels → Run Stock Check → review products below reorder point → adjust quantities → copy PO email → paste into email client → send to manufacturer

**Processing a customer order:**
> Orders → New Order → fill details → submit → Stock Check tab → Invoice tab → copy to Xero → Courier tab → enter waybill → advance to Dispatched

**Weekly PnP dispatch:**
> PnP Weekly → upload Excel → review matched SKUs → stock check → generate dispatch email → copy and send → mark dispatched

**Recording a delivery:**
> Dashboard → Stock In: Record Delivery → enter delivery note details → add product lines with batch numbers → submit → stock levels increase

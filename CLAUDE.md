# MyCanary — Project Guide

## What Is This
Multi-tenant stock management early warning system. First client: The Herbal Horse & Pet (THH).
Domain: mycanary.biz. Phase 1 = human in the loop (copy/paste). No autonomous actions.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + shadcn/ui (Radix) + Recharts
- **Backend**: Express + TypeScript (tsx for dev, esbuild for prod)
- **ORM**: Drizzle ORM
- **Database**: Neon PostgreSQL (dev + prod)
- **Auth**: Google OAuth (OIDC) with server-side PostgreSQL sessions
- **Hosting**: Vercel (static frontend + serverless API)

## Commands
- `npm run dev` — start dev server (Express 5000 + Vite 5173)
- `npm run build` — build frontend
- `npm run build:api` — bundle serverless API (run after ANY server change)
- `npm run db:push` — push schema to database

## Project Conventions
- Server imports: relative paths (`../shared/schema`), NOT `@shared`
- Client imports: `@/` and `@shared/` aliases OK
- `api/index.mjs` is committed to git
- `cross-env` in npm scripts for Windows
- NEVER use `tsx watch` — infinite restart loops on Windows
- Tailwind v4 uses `@tailwindcss/vite` plugin — no tailwindcss in postcss

## Multi-Tenancy
- Every data table has `clientId`, every query scoped via `getClientId(req)`
- Platform tables (users, sessions, invitedUsers, accessRequests, auditLogs) have NO clientId
- Admin scaffold is platform-level — DO NOT MODIFY
- `clientContext.ts` middleware: currently hardcoded to client 1, will resolve from subdomain in future

## Shared Calculations (`shared/calculations/`)
- `stock.ts` — calcStockStatus, calcDepletionRate, calcDaysRemaining, calcProjectedReorderDate, calcOverallStatus, calcReorderPoint, calcRecommendedOrderQty
- `po.ts` — calcExpectedDeliveryDate, calcDaysUntilDelivery, isPoOverdue, isValidPoTransition
- `formatters.ts` — date formatting, stock formatting, status badges, daysFromNow

## Shared UI Components
- `StickyActionBar` — pinned bottom action bar
- `PageTabs` — text tabs with underline
- `ErrorBox` — consistent error display
- `LoadingOverlay` — full-screen loading state
- `ImportWizard` — reusable Source → Clean → Confirm → Done wizard

## Shared Client Helpers (`client/src/lib/`)
- `formatters.ts` — re-exports from shared/calculations
- `invalidation.ts` — `invalidateStockData(qc)`, `invalidateOrderData(qc)`
- `queryClient.ts` — TanStack Query config + `apiRequest()` fetch wrapper

## Navigation Structure
- **Snapshot** — daily briefing (home)
- **Stock** — Stock Levels, Supplies, Orders, PnP Weekly, Xero Import, Reorder, Purchase Orders, Record Delivery
- **Tools** — Opening Balance Import, Supply Import, Stock Adjustment, Stock Transfer
- **Settings** — Products & SKUs, Manufacturers, System Settings

## Colour Tokens (index.css @theme)
stock-in (green), stock-out (red), warning (amber), info (blue), invoiced (purple), muted (grey), brand-primary (neutral dark)

## Key Domain Concepts
- Two brands: THH (own) and NP (Nutriphase via PnP)
- Two stock locations: THH (premises) and 88 (8/8 courier warehouse)
- Two manufacturers: Zinchar and Nutrimed (~5 week lead times)
- Supplies: raw materials + packaging, tracked via same ledger pattern as stock
- Channel codes from Xero: D=Direct, W=Wholesale, R=Retail, C=PnP, G=AP-Brand
- Setup Journey: 6 steps (Products, Suppliers, Opening Stock, Reorder Points, Sales Data, Supplies)
- Canary Snapshot: status line + data/visual lenses + risk filters + working rhythm prompts

## Project Memory
@.claude/memory/index.md

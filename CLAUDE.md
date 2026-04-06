# THHP Reorderer — Operations Management App

## Project
Operations management web application for The Herbal Horse & Pet (THH).
Stock ledger, reorder monitoring, email order fulfilment, PnP dispatch coordination.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + shadcn/ui (Radix)
- **Backend**: Express + TypeScript (tsx for dev, esbuild for prod)
- **ORM**: Drizzle ORM
- **Database**: Neon PostgreSQL (dev + prod branches)
- **Auth**: Google OAuth (OIDC) with server-side PostgreSQL sessions
- **Hosting**: Vercel (static frontend + serverless API)

## Conventions
- Server imports use relative paths (`../shared/schema`), NOT `@shared` aliases
- Client imports can use `@/` and `@shared/` aliases
- After ANY server-side change, run `npm run build:api`
- The `api/index.mjs` file is committed to git
- Use `cross-env` in npm scripts for Windows compatibility
- NEVER use `tsx watch` — causes infinite restart loops on Windows
- Tailwind CSS v4 uses `@tailwindcss/vite` plugin — do NOT add `tailwindcss` to postcss.config.js
- Express runs on port 5000, Vite on 5173

## Commands
- `npm run dev` — start dev server (Express + Vite)
- `npm run build` — build frontend
- `npm run build:api` — bundle serverless API
- `npm run db:push` — push schema to database

## Business Context
- THH = The Herbal Horse & Pet brand, NP = Nutriphase brand
- Two stock locations: THH (premises) and 88 (8/8 courier warehouse)
- Two manufacturers: Zinchar and Nutrimed
- Reorder Point = (annual_sales_units / 365) * 75
- Stock display: units + cases side-by-side (except horse mixes = units only)
- Channel codes from Xero: D=Direct, W=Wholesale, R=Retail, C=PnP, G=AP-Brand
- Phase 1 = manual copy/paste workflows; Phase 2 = API automation

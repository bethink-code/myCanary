# MyCanary — Stock Management Early Warning Platform

## Project
Multi-tenant stock management early warning system for small product-based businesses.
First client: The Herbal Horse & Pet (THH). Domain: mycanary.biz.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + shadcn/ui (Radix) + Recharts
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
- Always `app.set("trust proxy", 1)` in production (Vercel reverse proxy)

## Commands
- `npm run dev` — start dev server (Express + Vite)
- `npm run build` — build frontend
- `npm run build:api` — bundle serverless API
- `npm run db:push` — push schema to database

## Architecture
- Multi-tenant: every data table has `clientId`, every query scoped by client
- Admin scaffold (users, invites, access requests, audit logs) is platform-level — DO NOT MODIFY
- Phase 1 = human in the loop (copy/paste). No autonomous actions.
- All colours via Tailwind tokens: stock-in, stock-out, warning, info, invoiced, muted, brand-primary
- No hardcoded hex values in components
- No decorative CSS — clean defaults only

## Key Concepts
- Canary Snapshot: home screen with status line, data/visual lenses, risk filters
- Setup Journey: 5-step onboarding for new clients
- PO Lifecycle: purchase orders tracked from creation through delivery
- Stock locations, channel codes, SKU mappings are per-client config, not hardcoded

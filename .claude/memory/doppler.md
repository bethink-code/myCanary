# Doppler — how secrets and DBs are reached

All secrets live in Doppler project `mycanary`. Configs:

| Config | Use |
| ------ | --- |
| `dev` | Shared dev environment (Neon dev DB) |
| `dev_personal` | Per-machine personal overrides |
| `stg` | Staging |
| `prd` | Production (Neon prod DB) |

`DATABASE_URL` is the single source of truth across environments — dev vs prod
is selected by Doppler config, not by a different variable name. There are no
`.env` files; `dotenv` was removed in commit `5b0c4fb`.

## Running against an environment

```bash
doppler run --project mycanary --config prd -- node -e "..."
doppler run --project mycanary --config dev -- npm run db:push
```

`npm run dev` and `npm run db:push` are already wrapped with `doppler run` so
they pick up the right config automatically when run from the project root.

## When you need this

- Inspecting prod data ad-hoc
- Running a one-off script against a specific environment
- Pushing schema (`db:push`) — must be run against both dev *and* prd before a
  release that depends on the change

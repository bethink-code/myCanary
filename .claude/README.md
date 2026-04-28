# `.claude/` — Project Claude Code Workspace

Centralised home for everything Claude Code uses on this project.
Auto-discovered by Claude Code when run from the repo root.

## Layout

| Path | Purpose | Committed? |
| ---- | ------- | ---------- |
| `settings.json` | Project-level settings (permissions, env, hooks) shared with the team | yes |
| `settings.local.json` | Per-machine overrides — gitignored | no |
| `skills/` | Project skills (`<name>/SKILL.md`) | yes |
| `agents/` | Project subagents (`<name>.md` with frontmatter) | yes |
| `commands/` | Project slash commands (`<name>.md`) | yes |
| `memory/` | Long-term project memory imported by root `CLAUDE.md` | yes |

## How memory loads

Root `CLAUDE.md` imports `@.claude/memory/index.md`, which in turn pulls in
everything else under `memory/`. To add a new memory note:

1. Create `memory/<topic>.md` with a short title and the fact/decision/why.
2. Add a one-line entry to `memory/index.md` so it gets pulled into context.

Keep notes short and durable — code-derivable details belong in the code,
not in memory.

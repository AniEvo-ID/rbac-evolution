# @anievo-id/rbac-evolution-cli

📖 **[Documentation](https://creation.anievo.id/rbac-evolution/basic-usage/cli)**

Command-line tool for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) — the JS/TS
equivalent of spatie/laravel-permission's `php artisan permission:*` commands.

**Status: 🧪 beta.**

```bash
npm i -D @anievo-id/rbac-evolution-cli
npx rbac-evolution init
```

## Setup

`rbac-evolution init` creates an `rbac.config.ts`. Point it at the same adapter and options your app uses:

```ts
// rbac.config.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineConfig({
  rbac: () => createRbac({ adapter: new PrismaAdapter(prisma), teams: true }),
  subjectType: 'user', // default type for assign-role / give-permission
  teardown: () => prisma.$disconnect(),
})
```

TypeScript configs work out of the box (`rbac.config.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`).
Use `--config path/to/file` for another location.

## Commands

| Command | spatie equivalent | Description |
| --- | --- | --- |
| `create-permission <name>` | `permission:create-permission` | Create a permission (skipped if it exists) |
| `create-role <name> ["a\|b"]` | `permission:create-role` | Create a role, optionally with permissions (missing ones are created) |
| `assign-role <role> <id>` | `permission:assign-role` | Assign a role to a subject |
| `give-permission <permission> <id>` | — | Give a direct permission to a subject |
| `show` | `permission:show` | Print the role × permission matrix per guard |
| `sync [--prune --yes] [--dry-run]` | — (spatie's seeders) | Create & sync roles and permissions from `seed` in the config or `--file` |
| `cache-reset` | `permission:cache-reset` | Flush the permission cache |
| `init` | — | Create `rbac.config.ts` |

Spatie-style names work too: `rbac-evolution permission:create-role writer`.

### Options

| Option | Description |
| --- | --- |
| `-g, --guard <name>` | Guard (default: the config's `defaultGuard`, usually `web`) |
| `-t, --team <id>` | Team id (requires `teams: true`) |
| `--type <type>` | Subject type for `assign-role` / `give-permission` (default: `subjectType` or `user`) |
| `--json` | JSON output for `show` and `sync` |
| `-f, --file <file>` | Seed file for `sync` (`.json`, `.ts`, `.js`, …; default: `seed` in the config) |
| `--prune` | `sync`: delete roles & permissions that are not in the seed (needs `--yes`, or `--dry-run` to preview) |
| `-y`, `--yes` | `sync --prune`: confirm the deletions |
| `--dry-run` | `sync`: print the plan without writing anything |
| `-c, --config <file>` | Config file |
| `--force` | Overwrite an existing `rbac.config.ts` (`init`) |
| `-h, --help` / `-v, --version` | Help / version — `rbac-evolution help <command>` shows a command's usage |

### Examples

```bash
npx rbac-evolution create-permission "edit articles"
npx rbac-evolution create-role writer "edit articles|delete articles"
npx rbac-evolution create-role manager --guard api --team 42
npx rbac-evolution assign-role writer 1
npx rbac-evolution assign-role bot 9f1c… --type client
npx rbac-evolution show
```

```
Guard: web
┌─────────────────┬───────┬────────┐
│ Permission      │ admin │ writer │
├─────────────────┼───────┼────────┤
│ delete articles │ ✔     │ ·      │
│ edit articles   │ ✔     │ ✔      │
└─────────────────┴───────┴────────┘
```

### Seeding with `sync`

Declare your roles & permissions in the config (or in a separate file) and run `sync` — it's
idempotent, so it's safe to run on every deploy:

```ts
// rbac.config.ts
export default defineConfig({
  rbac: () => createRbac({ adapter }),
  seed: {
    permissions: ['edit articles', 'delete articles', 'publish articles'],
    roles: {
      admin: '*', // every permission of the guard
      writer: ['edit articles'],
    },
  },
})
```

```bash
npx rbac-evolution sync --dry-run   # show the plan
npx rbac-evolution sync             # create missing roles/permissions, sync role permissions
npx rbac-evolution sync --prune --yes  # ... and delete roles/permissions not in the seed
npx rbac-evolution sync --file roles.json
```

```
+ permission `publish articles` (guard web)
+ role `writer` (guard web): edit articles
~ role `admin` (guard web): +publish articles

Done: created 1 permission & 1 role, updated 1 role, deleted 0 roles & 0 permissions.
```

`seed` (and a `--file`) may also be an array of definitions, each with its own `guard` / `team`.
`--guard` / `--team` set the default scope. See `rbac.sync()` in the core package for the details.

### Notes

- `cache-reset` clears the cache of the `Rbac` instance in your config. With the default in-memory
  cache that only affects the CLI process — it's useful with a shared cache store (Redis, KV, …).
- Exit codes: `0` success, `1` error (e.g. unknown role), `2` usage error.

## Programmatic use

```ts
import { run } from '@anievo-id/rbac-evolution-cli'

const exitCode = await run(['create-role', 'writer', 'edit articles'], { config })
```

## License

MIT

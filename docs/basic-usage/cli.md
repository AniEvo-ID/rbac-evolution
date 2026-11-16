# CLI

`@anievo-id/rbac-evolution-cli` lets you manage roles and permissions from the terminal, much like spatie's `php artisan permission:*` commands. It is handy for seeding, for one-off fixes in production, and for checking what is configured.

## Installation

::: code-group

```bash [npm]
npm i -D @anievo-id/rbac-evolution-cli
```

```bash [pnpm]
pnpm add -D @anievo-id/rbac-evolution-cli
```

```bash [yarn]
yarn add -D @anievo-id/rbac-evolution-cli
```

```bash [bun]
bun add -d @anievo-id/rbac-evolution-cli
```

:::

The binary is called `rbac-evolution`.

## Configuration

The CLI needs to know which database to talk to. Create a config file:

```bash
npx rbac-evolution init
```

This writes `rbac.config.ts` to the current directory (use `--force` to overwrite an existing one). Edit it to use the same adapter and options as your app:

```ts
// rbac.config.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineConfig({
  rbac: () => createRbac({ adapter: new PrismaAdapter(prisma), teams: true }),
  subjectType: 'user',
  teardown: () => prisma.$disconnect(),
})
```

| Field | Required | Description |
| --- | --- | --- |
| `rbac` | yes | An `Rbac` instance, or a function (sync or async) that returns one. A function delays opening connections until a command actually runs. |
| `subjectType` | no | Default subject type for `assign-role` and `give-permission`. Default: `user`. |
| `teardown` | no | Runs after every command, for example to close the database connection. |

::: warning Use the same options as your app
The config must create the engine with the same `defaultGuard`, `teams` and `wildcard` settings as your app. Otherwise the CLI may create roles in a different guard, or reject team ids.
:::

The CLI looks for these files in the current directory, in order: `rbac.config.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`. TypeScript works without a build step. To use a file elsewhere, pass `--config path/to/file`.

## Commands

| Command | spatie equivalent | Description |
| --- | --- | --- |
| `init` | — | Create `rbac.config.ts` |
| `create-permission <name>` | `permission:create-permission` | Create a permission. Skipped if it already exists. |
| `create-role <name> [permissions]` | `permission:create-role` | Create a role, optionally with permissions. Missing permissions are created. |
| `assign-role <role> <subject-id>` | `permission:assign-role` | Assign a role to a subject |
| `give-permission <permission> <subject-id>` | — | Give a direct permission to a subject |
| `show` | `permission:show` | Print the role × permission matrix for each guard |
| `cache-reset` | `permission:cache-reset` | Clear the permission cache |
| `help [command]` | — | Show help, or help for one command |

Each command can also be written spatie-style, with a `permission:` prefix:

```bash
npx rbac-evolution permission:create-role writer
```

### `create-permission`

```bash
npx rbac-evolution create-permission "edit articles"
npx rbac-evolution create-permission "edit articles" --guard api
```

If the permission already exists, the command says so and succeeds.

### `create-role`

```bash
npx rbac-evolution create-role writer
npx rbac-evolution create-role writer "edit articles|delete articles"
npx rbac-evolution create-role editor "edit articles" "publish articles"
npx rbac-evolution create-role manager --guard api --team 42
```

Permissions can be separated with `|` (like spatie) or passed as separate arguments. Permissions that don't exist yet are created in the role's guard. If the role already exists, it is reused and the permissions are added to it, so the command is safe to run repeatedly.

### `assign-role`

```bash
npx rbac-evolution assign-role writer 1
npx rbac-evolution assign-role admin 1 --team 42
npx rbac-evolution assign-role bot c_9f1c --type client
```

The subject is `{ type, id }`. The type comes from `--type`, then `subjectType` in the config, then defaults to `user`. Ids made only of digits are passed as numbers; anything else (UUIDs, ...) as strings.

The role must exist. An unknown role exits with code `1`.

### `give-permission`

```bash
npx rbac-evolution give-permission "publish articles" 1
npx rbac-evolution give-permission "edit articles" c_9f1c --type client --guard api
```

Works like `assign-role`, but for a [direct permission](/basic-usage/direct-permissions). The permission must exist.

### `show`

```bash
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

Without options, every guard is shown. Use `--guard` to show one guard, `--team` to show only global roles plus the roles of that team, and `--json` for machine-readable output:

```bash
npx rbac-evolution show --guard api --json
```

```json
[
  {
    "guard": "api",
    "permissions": ["edit articles"],
    "roles": [{ "name": "integration", "teamId": null, "permissions": ["edit articles"] }]
  }
]
```

Team roles appear as `name (team 42)` in the table.

### `cache-reset`

```bash
npx rbac-evolution cache-reset
```

Calls `rbac.forgetCachedPermissions()` on the instance from your config.

::: info
With the default in-memory cache, this only clears the CLI process's own cache, not your running app's. The command is useful when your app uses a shared cache store such as Redis. See [Cache](/advanced/cache).
:::

## Options

| Option | Description |
| --- | --- |
| `-g, --guard <name>` | Guard to use. Default: the config's `defaultGuard`, usually `web`. |
| `-t, --team <id>` | Team id. Requires `teams: true` in the config. |
| `--type <type>` | Subject type for `assign-role` / `give-permission`. Default: `subjectType`, or `user`. |
| `--json` | JSON output for `show` |
| `--force` | Overwrite an existing config with `init` |
| `-c, --config <file>` | Config file to load |
| `-h, --help` | Show help (also `rbac-evolution <command> --help`) |
| `-v, --version` | Show the CLI version |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error, e.g. an unknown role or a missing config file |
| `2` | Usage error, e.g. an unknown command, unknown option or missing argument |

## Seeding with npm scripts

Because `create-role` creates missing permissions and reuses existing roles, you can keep a simple seed in `package.json`:

```json
{
  "scripts": {
    "rbac:seed": "rbac-evolution create-role admin \"manage users|edit articles\" && rbac-evolution create-role writer \"edit articles\""
  }
}
```

For anything bigger, write a seed script with the [core API](/basic-usage/basic-usage) and `findOrCreatePermission()` / `findOrCreateRole()`.

## Programmatic use

The CLI can be run from code. `run()` returns the exit code instead of exiting the process:

```ts
import { run } from '@anievo-id/rbac-evolution-cli'
import config from './rbac.config'

const exitCode = await run(['create-role', 'writer', 'edit articles'], { config })
```

`run()` also accepts `cwd` (where to look for the config file) and `io` (custom `out` / `err` writers, useful in tests).

Full API: [reference](/api/cli/)

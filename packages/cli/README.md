# @anievo-id/rbac-evolution-cli

Command-line tool for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution), the JS/TS counterpart of
spatie/laravel-permission's `php artisan permission:*` commands.

**Status: beta.**

## Install

```bash
npm i -D @anievo-id/rbac-evolution-cli
npx rbac-evolution init # creates rbac.config.ts
```

## Usage

Point `rbac.config.ts` at the same adapter and options your app uses:

```ts
// rbac.config.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineConfig({
  rbac: () => createRbac({ adapter: new PrismaAdapter(prisma) }),
  seed: { permissions: ['edit articles'], roles: { admin: '*', writer: ['edit articles'] } },
  teardown: () => prisma.$disconnect(),
})
```

```bash
npx rbac-evolution create-role writer "edit articles|delete articles"
npx rbac-evolution assign-role writer 1
npx rbac-evolution show             # role x permission matrix
npx rbac-evolution sync --dry-run   # show the seed plan; run again without --dry-run to apply it
npx rbac-evolution cache-reset
```

Spatie-style names work too: `rbac-evolution permission:create-role writer`.

- `sync --prune` deletes roles and permissions that are not in the seed. It needs `--yes` (or `--dry-run`).
- `cache-reset` clears the cache of the `Rbac` instance in the config. With the default in-memory cache that is
  only the CLI process, so it is mainly useful with a shared cache store.
- Exit codes: `0` success, `1` error, `2` usage error.

## Documentation

https://creation.anievo.id/rbac-evolution/basic-usage/cli

## License

MIT

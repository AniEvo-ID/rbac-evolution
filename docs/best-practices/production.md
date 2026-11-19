# Production checklist

What to check before RBAC Evolution runs in production. Each section is short and links to the page with the
details. The full list is at the [end of the page](#checklist).

## Enforce on the server

Every page, server action and API route that reads or changes protected data needs a server-side check:
`rbac.for(user).can()`, a framework guard (`requirePermission()`, `withPermission()`, `@RequirePermissions()`, ...)
or a Nitro helper. `<Can>`, `v-can` and the Next.js middleware only decide what is shown or where people are sent.

See [Security: enforce on the server](/best-practices/security#enforce-on-the-server-decorate-on-the-client) and the
[threat model](/best-practices/threat-model).

## Share the cache between processes

The default cache lives in one process. A change clears only the cache of the process that made it, so with several
instances (a cluster, containers, serverless functions) a revoked permission can keep working in the others until
the TTL runs out. The default TTL is 24 hours.

Pick one:

```ts
import { RedisCache } from '@anievo-id/rbac-evolution-redis'

createRbac({ adapter, cache: new RedisCache({ client: redis }) }) // shared store in Redis or Valkey
createRbac({ adapter, cacheTtl: 60_000 })                         // short TTL: stale for at most a minute
createRbac({ adapter, cache: false })                             // always fresh, more queries
```

A shared store must be dedicated to RBAC Evolution or namespaced, because the engine calls `clear()` after every
change. If something writes to the tables without the engine (SQL, a migration, another service), call
`rbac.forgetCachedPermissions()` afterwards. See [Cache](/advanced/cache#multiple-processes) for a Redis store and
for broadcasting clears.

## Teams: check membership

With `teams: true`, every check is scoped to the team you pass. The library does not know who belongs to which team.
If the team id comes from the request (URL, header, cookie), check that the user is a member **before** you pass it
on, or a user can switch to a team where they hold a strong role. See [Teams](/basic-usage/teams) and the
[multi-tenant recipe](/recipes/multi-tenant).

## Seed roles and permissions on deploy

Keep the roles and permissions in code and apply them with `rbac.sync()` or the CLI:

```bash
npx rbac-evolution sync --dry-run   # review the plan
npx rbac-evolution sync             # apply it
```

- `sync()` is idempotent. Run it once per deploy as a release step, not at the start of every instance: it is not
  atomic, and two instances syncing at the same time can get in each other's way.
- Create the tables with your normal migrations first (Prisma, drizzle-kit, Kysely migrator).
- `--prune` deletes roles and permissions that are not in the seed, and with them every assignment. Always run it
  with `--dry-run` first.

See [Seeding](/advanced/seeding) and [CLI](/basic-usage/cli).

## Monitor and audit through events

The engine emits an event after every change: `role.attached`, `role.detached`, `permission.attached`,
`permission.detached`, `role.created`, `role.deleted`, `permission.created` and `permission.deleted`. Use them to:

- write an audit log of who received or lost which role,
- alert when a privileged role (for example `super-admin`) is attached,
- broadcast cache clears to other processes.

Listeners are awaited, and an error in a listener reaches the caller after the change is saved. Catch errors inside
your listeners. See [Events](/advanced/events) and the [audit log recipe](/recipes/audit-log).

## Keep error responses quiet

A 403 should say *that* access was denied, not *what* was needed. Leave `exposeRequirements` off (it is off by
default) in Express, Fastify, Hono and NestJS, and don't send engine errors such as `PermissionDoesNotExist` to
clients. See [Security: error responses](/best-practices/security#error-responses) and [Errors](/advanced/errors).

## Use typed names

A typo in a permission name never throws: `can('edit artcles')` just returns `false`. Give `createRbac` a type for
your names, and pass the same type to `createGuards()` and `createRbacDecorators()`, so typos fail the build. See
[Typed names](/basic-usage/typed-names).

## Choose the adapter

Use the adapter for the ORM you already have ([overview](/adapters/overview)). `MemoryAdapter` keeps everything in
memory and loses it on restart, so it is for tests and prototypes only.

Collation matters on MySQL. Names and ids that differ only by case or a trailing space should stay apart. The
adapters re-check every row in JavaScript, but the database's unique keys still follow the column collation:

- **Drizzle and Kysely** create MySQL columns with `utf8mb4_bin` (case-sensitive).
- **Prisma** uses the database default, which is usually case-insensitive. If your names or ids are case-sensitive,
  give the database or tables `utf8mb4_0900_bin` (MySQL 8) or `utf8mb4_nopad_bin` (MariaDB).

See the [Prisma database notes](/adapters/prisma#database-notes) and the
[Drizzle column types](/adapters/drizzle#column-types).

## Upgrading

- All packages share one version number. Upgrade them together.
- Before 1.0, a minor release can change the API. Read [What's new](/guide/whats-new) and the
  [changelog](https://github.com/AniEvo-ID/rbac-evolution/blob/main/packages/core/CHANGELOG.md) first.
- Install from a lockfile and run `npm audit signatures` to check the provenance of the packages. See
  [Security: verifying the packages](/best-practices/security#verifying-the-packages).

## Checklist

- [ ] Every page, action and API route that touches protected data has a server-side check.
- [ ] Client-side checks only show or hide UI.
- [ ] Several processes: a shared cache store, a short `cacheTtl`, or `cache: false`.
- [ ] `rbac.forgetCachedPermissions()` runs after changes made outside the engine.
- [ ] Team ids from requests are checked for membership.
- [ ] Tables are created by migrations; roles and permissions are seeded with `sync` once per deploy.
- [ ] `sync --prune` is only run after a `--dry-run`.
- [ ] Event listeners write an audit log and catch their own errors.
- [ ] Assignments of privileged roles raise an alert.
- [ ] `exposeRequirements` is off; engine errors are not sent to clients.
- [ ] Names are typed with `createRbac<AppRbac>()` and the typed guards.
- [ ] A real database adapter, not `MemoryAdapter`; MySQL collation checked.
- [ ] All `@anievo-id/rbac-evolution*` packages are on the same version, installed from a lockfile.

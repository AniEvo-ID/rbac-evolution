# Upgrading to 1.0

1.0 contains no breaking changes compared to the last 0.x release. Code that runs on 0.8 runs on 1.0. If you come
from an older 0.x version, these are the changes to look at, newest first. Each one links to its release in the
[changelog](https://github.com/AniEvo-ID/rbac-evolution/blob/main/packages/core/CHANGELOG.md).

## From 0.7 to 0.8

**Guard calls that could not work are now type errors.** A guard called with no names, with only options, or with
options before a name failed at runtime (it threw, or ignored the options). TypeScript now rejects it:

```ts
requirePermission() // type error (it threw a TypeError when the route was defined)
requireRole({ all: true }) // type error (no names)
requirePermission({ any: true }, 'edit articles') // type error: options go last
requirePermission('edit articles', { any: true }) // ok
```

**Typed names reach the integrations.** Nothing changes unless you opt in. See
[typed names](/basic-usage/typed-names#in-guards-middleware-and-the-cli).

## From 0.6 to 0.7

**Engine internals are private.** `rbac.gate`, `rbac.events`, `rbac.resolveGuard`, `rbac.resolveTeam`,
`rbac.resolveRoles`, `rbac.resolvePermissions`, `rbac.permissionExists`, `rbac.permissionMatches`, `rbac.remember`
and `rbac.visibleTeams` were marked `@internal` and are now gone from the public instance. Use the documented API
instead:

| Before | After |
| --- | --- |
| `rbac.events.on(...)` | `rbac.on(...)` / `rbac.off(...)` |
| `rbac.resolveGuard(guard)` | `guard ?? rbac.defaultGuard` |
| `rbac.permissionMatches(granted, name)` | `rbac.for(subject).hasPermissionTo(name)` |
| `rbac.gate(subject, name)` | `rbac.for(subject).can(name)` |

**Lookalike subject ids no longer share roles (security).** On MySQL and SQL Server, the Drizzle, Kysely and
Prisma adapters gave a subject id like `'admin '` (trailing space) the roles of `'admin'`. With Prisma on MySQL,
`'ADMIN'` matched too. Every row is now compared exactly. No migration is needed. With Prisma on MySQL, consider a
binary collation without padding (`utf8mb4_0900_bin`), so lookalike names can also be stored side by side.

**Custom adapters:** the conformance suite (`runAdapterTests`) now checks exact matching of names, subject ids and
team ids. If your columns use a case-insensitive collation, compare rows again in JavaScript, as the built-in
adapters do.

**Options accept an explicit `undefined`** (0.7.1). Under `exactOptionalPropertyTypes`,
`rbac.for(user, { guard: maybeGuard })` now compiles. You can remove `...(guard !== undefined && { guard })`
workarounds.

## From 0.5 to 0.6

**Guards with only blank names throw when they are defined.** `requireRole(' | ')`,
`requireRoleOrPermission(' ')` and `requirePermission('', { any: true })` used to answer 403 on every request. If
names come from configuration, check them before building the guard.

## SQL Server with Kysely (0.6.6)

`createRbacTables` creates string columns with the binary collation `Latin1_General_100_BIN2`, so `'Edit'` and
`'edit'` are different names. Tables created before 0.6.6 keep the server's default (usually case-insensitive)
collation. Recreate them, or change the columns' collation.

## Checklist

- [ ] Upgrade every `@anievo-id/rbac-evolution*` package to the same version.
- [ ] Run your type checker. Fix guard calls it now rejects.
- [ ] Replace any use of the removed `@internal` engine members.
- [ ] If you maintain a custom adapter, run `runAdapterTests` against it.
- [ ] Read the [versioning promise](/guide/versioning) for what 1.x can and cannot change.

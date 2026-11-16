# Temporary access

A role or a direct permission can end on its own. Give it an `expiresAt`, and from that moment on every check
treats it as gone: no revoke job, no table of your own.

```ts
const user = rbac.for({ type: 'user', id: 7 })

await user.assignRole('on-call', { expiresAt: new Date('2026-03-02T08:00:00Z') })
await user.givePermissionTo('customers.impersonate', { expiresAt: new Date(Date.now() + 2 * 3_600_000) })
```

The options object always comes last, after the names (or arrays of names): `assignRole('a', 'b', { expiresAt })`.

New in 1.2. Expiry needs one extra column, so it is **off until you turn it on in the adapter**. See
[Turning it on](#turning-it-on).

## What expires, and when

- **Per link.** The expiry belongs to one role assignment or one direct permission of one subject, in one
  [guard](/basic-usage/multiple-guards) and one [team](/basic-usage/teams). The same role can be permanent in one
  team and temporary in another.
- **Roles and permissions themselves never expire,** and neither do the permissions of a role. To give a whole
  role for a while, give the role with an expiry; its permissions go with it.
- **At `expiresAt` exactly, the link is gone.** A link is active while `now < expiresAt`.
- **`now` is the engine's clock**: `new Date()` on the server that runs the check, or the `now` option of
  `createRbac()` (handy in tests, see [below](#testing)). The database clock is never used.

Every read follows the clock: `can()`, `hasRole()`, `hasPermissionTo()`, `getRoleNames()`, `snapshot()` (and so the
[React](/frameworks/react) and [Vue](/frameworks/vue) UI), `subjectsWithRole()`, `subjectsWithPermission()`,
`teams()`, and the events of `removeRole()`, `revokeAll()` and `deleteTeam()`, which don't list links that already
expired.

::: tip A snapshot in the browser doesn't expire by itself
The UI snapshot only lists what was active when the server made it. If a page stays open past an `expiresAt`, the
UI keeps showing the action until it loads a new snapshot; the server denies the request either way. Refresh the
snapshot on navigation, or read the end time with `getRoleAssignments()` and schedule a refresh.
:::

## Giving it again: the latest call wins

`assignRole()` and `givePermissionTo()` write the expiry of every link they name, also of links the subject already
has. Like spatie, the last call decides:

```ts
await user.assignRole('on-call', { expiresAt: inEightHours }) // until then
await user.assignRole('on-call', { expiresAt: inTwelveHours }) // extended
await user.assignRole('on-call', { expiresAt: inOneHour })     // shortened
await user.assignRole('on-call')                               // permanent again
await user.assignRole('on-call', { expiresAt: null })          // the same: permanent
```

So a call without `expiresAt` means "permanent", even for a link that had an expiry. To only ever extend, read the
current end first (see [Reading the end time](#reading-the-end-time)).

A link that has already expired counts as absent, so giving it again simply starts it over (and fires
`role.attached` / `permission.attached` again).

### Syncing

`syncRoles()` and `syncPermissions()` set the list of links. With an `expiresAt`, every listed link gets it:

```ts
await user.syncRoles(['on-call', 'viewer'], { expiresAt: endOfShift }) // both until the end of the shift
```

**Without `expiresAt`, a sync only changes which links exist:** links that stay keep their expiry, and links it
adds are permanent. A form that syncs a user's roles therefore never turns a temporary role into a permanent one by
accident. Pass `{ expiresAt: null }` to make every listed link permanent.

```ts
await user.assignRole('on-call', { expiresAt: endOfShift })
await user.syncRoles('on-call', 'viewer') // on-call still ends at endOfShift; viewer is permanent
```

## Reading the end time

`getRoleAssignments()` and `getDirectPermissionAssignments()` return what the subject holds now (in its guard and
team), each with `expiresAt` (`null` = permanent). Expired links are not listed.

```ts
const roles = await user.getRoleAssignments()
// [{ role: { id: 3, name: 'on-call', ... }, expiresAt: 2026-03-02T08:00:00.000Z }]

const grants = await user.getDirectPermissionAssignments()
// [{ permission: { id: 9, name: 'customers.impersonate', ... }, expiresAt: 2026-03-01T14:00:00.000Z }]
```

Extend only, never shorten:

```ts
const until = new Date(Date.now() + 2 * 3_600_000)
const current = (await user.getDirectPermissionAssignments()).find((g) => g.permission.name === 'customers.impersonate')
if (!current || (current.expiresAt !== null && current.expiresAt < until)) {
  await user.givePermissionTo('customers.impersonate', { expiresAt: until })
}
```

## Cleaning up

Expired rows stay in the database: checks skip them, so nothing has to delete them on time. To keep the tables
small, delete them now and then:

```ts
const { roles, permissions } = await rbac.pruneExpired() // how many links were deleted
```

`pruneExpired()` deletes every expired link of every subject, team and guard, in one statement per table. Run it from
a nightly job. It emits **no events** and doesn't clear the cache: the access already ended at `expiresAt`, so
nothing changes for any check, and an audit log would get a misleading time. Use the `expiresAt` of the
`role.attached` / `permission.attached` events to record when access ends. See [Events](/advanced/events).

Removing a link by hand (`removeRole()`, `revokePermissionTo()`, `syncRoles()`, `revokeAll()`, `deleteTeam()`)
deletes it whether it expired or not.

## The cache

A cached subject state never outlives the earliest `expiresAt` inside it: the entry's TTL is cut to end there, and
the state also carries that moment, so a store that keeps it longer (Redis rounds `EX` to whole seconds) is not
trusted past it. See [Cache](/advanced/cache#expiry).

## Turning it on

Without the option, every adapter works exactly as in 1.1 and never reads or writes an expiry column, so upgrading
needs no migration. To use expiry:

1. Add the nullable `expires_at` column to `model_has_roles` and `model_has_permissions` (MongoDB: nothing to do).
   Existing rows get `NULL`, which means permanent.
2. Create the adapter with `{ expiry: true }`.

| Adapter | Step 1 | Step 2 |
| --- | --- | --- |
| [Prisma](/adapters/prisma#expiry-1-2) | add `expiresAt DateTime? @map("expires_at")` to two models, then migrate | `new PrismaAdapter(prisma, { expiry: true })` |
| [Drizzle](/adapters/drizzle#expiry-1-2) | `sql/<dialect>-expiry.sql`, or drizzle-kit with `pgRbacSchema({ expiry: true })` | `drizzlePgAdapter(db, pgRbacSchema({ expiry: true }), { expiry: true })` |
| [Kysely](/adapters/kysely#expiry-1-2) | `rbacExpiryMigration()` or `addRbacExpiryColumns(db)` | `kyselyAdapter(db, { expiry: true })` |
| [Mongoose](/adapters/mongoose#expiry-1-2) | none | `mongooseAdapter({ expiry: true })` |
| [Memory](/adapters/memory) | none | `new MemoryAdapter({ expiry: true })` |
| [Custom](/adapters/custom#expiry) | your own | `supportsExpiry: true` and three methods |

If an `expiresAt` reaches an adapter without expiry, the call throws an `RbacError` with code
`EXPIRY_NOT_SUPPORTED` and writes nothing. It never stores the link as permanent instead. `{ expiresAt: null }` and
calls without options work on every adapter.

```ts
import { RbacError } from '@anievo-id/rbac-evolution'

try {
  await user.assignRole('on-call', { expiresAt: endOfShift })
} catch (error) {
  if (!(error instanceof RbacError) || error.code !== 'EXPIRY_NOT_SUPPORTED') throw error
  // the adapter was created without { expiry: true }: nothing was written
}
```

## Testing

Pass a clock to the engine and move it:

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

let now = new Date('2026-03-01T12:00:00Z')
const rbac = createRbac({ adapter: new MemoryAdapter({ expiry: true }), now: () => now })

await rbac.createRole('on-call')
await rbac.for(user).assignRole('on-call', { expiresAt: new Date('2026-03-01T20:00:00Z') })
await rbac.for(user).hasRole('on-call') // true

now = new Date('2026-03-01T20:00:00Z')
await rbac.for(user).hasRole('on-call') // false
```

## Related

- [Permissions via roles](/basic-usage/roles) and [Direct permissions](/basic-usage/direct-permissions)
- [Internal admin panel](/use-cases/internal-tools): impersonation for a few hours
- [Cache](/advanced/cache#expiry) and [Events](/advanced/events)

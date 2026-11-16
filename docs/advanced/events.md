# Events

The engine emits an event after every change to roles, permissions and their assignments. Use events for audit logs, sending notifications, syncing a search index, or broadcasting a cache clear to other processes.

## Listening

```ts
const off = rbac.on('role.attached', async ({ subject, roles, teamId }) => {
  console.log(`${subject.type}#${subject.id} got ${roles.map((r) => r.name).join(', ')}`)
})

// later
off()
```

| Method | Description |
| --- | --- |
| `rbac.on(event, listener)` | Adds a listener and returns a function that removes it. |
| `rbac.off(event, listener)` | Removes a listener added with `on`. You need the same function reference. |

Listeners may be sync or async. Each one receives a payload typed for its event.

## All events

| Event | Fired by | Payload (besides `event`) |
| --- | --- | --- |
| `role.attached` | `assignRole`, `syncRoles` | `subject`, `roles`, `guardName`, `teamId` |
| `role.detached` | `removeRole`, `syncRoles` | `subject`, `roles`, `guardName`, `teamId` |
| `permission.attached` | `givePermissionTo`, `syncPermissions` on a **subject** or a **role** | `target` + `subject` or `role`, `permissions`, `guardName`, `teamId` |
| `permission.detached` | `revokePermissionTo`, `syncPermissions` on a **subject** or a **role** | `target` + `subject` or `role`, `permissions`, `guardName`, `teamId` |
| `role.created` | `createRole`, `findOrCreateRole` (when it creates) | `role`, `teamId` |
| `role.deleted` | `deleteRole` | `role`, `teamId` |
| `permission.created` | `createPermission`, `findOrCreatePermission` (when it creates) | `permission` |
| `permission.deleted` | `deletePermission` | `permission` |

Every payload can also carry `actor`, who made the change, when it is known. See [Who made the change](#who-made-the-change-actor).

## Payload shapes

Every payload has an `event` field that holds its own name, which makes the union easy to narrow.

```ts
import type { Permission, Role, RbacActor, Subject, TeamId } from '@anievo-id/rbac-evolution'

// every event
interface RbacEventBase {
  actor?: RbacActor // Subject | string: who made the change, when known
}

// role.attached / role.detached
interface RoleAttachedEvent extends RbacEventBase {
  event: 'role.attached' // or 'role.detached'
  subject: Subject
  roles: Role[]          // only the roles that actually changed
  guardName: string
  teamId: TeamId         // the subject's team scope
}

// permission.attached / permission.detached
type PermissionTarget =
  | { target: 'subject'; subject: Subject } // direct permission
  | { target: 'role'; role: Role }          // permission of a role

type PermissionAttachedEvent = {
  event: 'permission.attached' // or 'permission.detached'
  permissions: Permission[]    // only the permissions that actually changed
  guardName: string
  teamId: TeamId               // subject's team scope, or the role's teamId
} & PermissionTarget & RbacEventBase

// role.created / role.deleted
interface RoleCreatedEvent extends RbacEventBase {
  event: 'role.created' // or 'role.deleted'
  role: Role
  teamId: TeamId
}

// permission.created / permission.deleted
interface PermissionCreatedEvent extends RbacEventBase {
  event: 'permission.created' // or 'permission.deleted'
  permission: Permission
}
```

The exported types are `RbacEventBase`, `RbacActor`, `RoleAttachedEvent`, `RoleDetachedEvent`, `PermissionAttachedEvent`, `PermissionDetachedEvent`, `PermissionTarget`, `RoleCreatedEvent`, `RoleDeletedEvent`, `PermissionCreatedEvent` and `PermissionDeletedEvent`. There are also these helpers:

| Type | Meaning |
| --- | --- |
| `RbacEventMap` | Event name → payload type |
| `RbacEventName` | Union of all event names |
| `RbacEvent` | Union of all payloads, discriminated by `event` |
| `RbacEventListener<K>` | `(payload: RbacEventMap[K]) => void \| Promise<void>` |

Narrow permission events with `target`:

```ts
rbac.on('permission.attached', (e) => {
  if (e.target === 'role') {
    console.log(`role ${e.role.name} now grants`, e.permissions.map((p) => p.name))
  } else {
    console.log(`${e.subject.type}#${e.subject.id} got direct`, e.permissions.map((p) => p.name))
  }
})
```

## Who made the change: `actor`

Audit logs need to know **who** made a change, not only what changed. Tell the engine, and every event carries it
as `actor`: a [subject](/basic-usage/basic-usage) such as `{ type: 'user', id: 7 }`, or a label such as `'system'`
or `'cli'` (`type RbacActor = Subject | string`).

**Per call.** Every write accepts `actor`:

```ts
const admin = { type: 'user', id: 7 }

await rbac.for(user, { actor: admin }).assignRole('writer') // also syncRoles, givePermissionTo, ...
await rbac.role('writer', { actor: admin }).givePermissionTo('edit articles')
await rbac.createRole('editor', { actor: admin })           // also createPermission, deleteRole, deletePermission
await rbac.sync({ roles: { writer: ['edit articles'] } }, { actor: 'deploy' }) // every write of the sync

rbac.on('role.attached', (e) => {
  e.actor // { type: 'user', id: 7 }
})
```

`rbac.for(user, { actor })` keeps the actor for every call on that helper, also after `withScope()`.

**From the request context.** Instead of passing it around, give the engine a `getActor` function. It runs when an
event has listeners and the call passed no `actor`; return `null` or `undefined` when there is none:

```ts
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRbac, type RbacActor } from '@anievo-id/rbac-evolution'

export const actorContext = new AsyncLocalStorage<RbacActor>()

export const rbac = createRbac({
  adapter,
  getActor: () => actorContext.getStore(),
})

// per request, after authentication (Express):
// app.use((req, res, next) => (req.user ? actorContext.run({ type: 'user', id: req.user.id }, next) : next()))
```

- An explicit `actor` wins over `getActor()`.
- Without either, the payload has **no** `actor` field, exactly as before.
- The core imports nothing runtime-specific: `getActor` can read any context. `AsyncLocalStorage` exists on Node.js
  and Bun, and on Cloudflare Workers with the `nodejs_compat` flag. Where there is none, pass `actor` per call. See
  [Runtimes](/guide/runtimes).

## Ordering and await semantics

- **After the write.** An event fires only after the adapter write has succeeded and the [cache](/advanced/cache) has been cleared. Listeners therefore see the new state when they query the engine.
- **In order, one at a time.** Listeners run in the order they were registered. Each one is awaited before the next starts.
- **The caller waits.** The method that caused the event (`assignRole`, `createRole`, ...) resolves only after **all** of its listeners have finished. A slow listener makes the call slow. For heavy work, put a job on a queue instead of doing it in the listener.
- **Errors reach the caller.** If a listener throws or rejects, the remaining listeners for that event are skipped and the error is thrown from the original call. **The change is already saved** at that point, and nothing is rolled back.

::: warning
Don't use a throwing listener to block a change. By the time it runs, the change has already been written. Check permissions before you call the engine, or use the `before` hook for `can()` checks (see [Super-admin](/basic-usage/super-admin)).
:::

## Only real changes are reported

- `roles` and `permissions` contain **only** the items that actually changed. Assigning a role the subject already has emits nothing. Revoking a permission the subject never had emits nothing.
- An event with an empty list is never emitted.
- `syncRoles` / `syncPermissions` emit `*.detached` for what was removed **first**, then `*.attached` for what was added. Items present before and after are not reported.
- Deleting a role or permission emits only `role.deleted` / `permission.deleted`. There is no `detached` event for every subject or role that had it.
- `findOrCreateRole` / `findOrCreatePermission` emit `*.created` only when they actually create a row.

::: info Cost
To work out what changed, attach and detach calls read the existing links once more before writing. They do this only when a listener is registered for that event, so events cost nothing if you don't use them.
:::

## Example: audit log

Write every change to an `audit_log` table. One handler subscribes to all eight events:

```ts
import type { RbacActor, RbacEvent, RbacEventName } from '@anievo-id/rbac-evolution'
import { rbac } from './rbac' // created with `getActor`, or calls that pass `actor`
import { db } from './db'

const actorId = (actor: RbacActor | undefined): string | null =>
  actor === undefined ? null : typeof actor === 'string' ? actor : `${actor.type}:${actor.id}`

function summarize(e: RbacEvent): string {
  switch (e.event) {
    case 'role.attached':
    case 'role.detached':
      return `${e.subject.type}#${e.subject.id}: ${e.roles.map((r) => r.name).join(', ')}`
    case 'permission.attached':
    case 'permission.detached': {
      const who = e.target === 'role' ? `role ${e.role.name}` : `${e.subject.type}#${e.subject.id}`
      return `${who}: ${e.permissions.map((p) => p.name).join(', ')}`
    }
    case 'role.created':
    case 'role.deleted':
      return `role ${e.role.name} (${e.role.guardName})`
    case 'permission.created':
    case 'permission.deleted':
      return `permission ${e.permission.name} (${e.permission.guardName})`
  }
}

async function audit(e: RbacEvent): Promise<void> {
  try {
    await db.insert(auditLog).values({
      action: e.event,
      summary: summarize(e),
      teamId: 'teamId' in e && e.teamId !== null ? String(e.teamId) : null,
      actorId: actorId(e.actor),
      payload: JSON.stringify(e),
      createdAt: new Date(),
    })
  } catch (error) {
    // Never let a logging failure surface as a failed role change.
    console.error('audit log failed', error)
  }
}

const events: RbacEventName[] = [
  'role.attached',
  'role.detached',
  'permission.attached',
  'permission.detached',
  'role.created',
  'role.deleted',
  'permission.created',
  'permission.deleted',
]

for (const name of events) rbac.on(name, audit)
```

`db` and `auditLog` stand for your own database client and table. Any ORM works.

## Example: broadcast cache clears

With several app instances and the default in-memory cache, each instance clears only its own cache. You can use events to tell the other instances:

```ts
import type { RbacEventName } from '@anievo-id/rbac-evolution'
import { Redis } from 'ioredis'
import { rbac } from './rbac'

const CHANNEL = 'rbac:changed'
const publisher = new Redis(process.env.REDIS_URL!)
const subscriber = new Redis(process.env.REDIS_URL!) // a subscribed connection can't publish

const events: RbacEventName[] = [
  'role.attached',
  'role.detached',
  'permission.attached',
  'permission.detached',
  'role.created',
  'role.deleted',
  'permission.created',
  'permission.deleted',
]

for (const name of events) {
  rbac.on(name, async () => {
    await publisher.publish(CHANNEL, '1')
  })
}

await subscriber.subscribe(CHANNEL)
subscriber.on('message', () => {
  void rbac.forgetCachedPermissions()
})
```

The instance that made the change receives its own message too. The extra clear is harmless. See [Cache: multiple processes](/advanced/cache#multiple-processes) for other options.

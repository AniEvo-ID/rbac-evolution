# Audit log from events

Record who gave which role or permission to whom, and raise an alert when someone receives a privileged role. The
engine emits an [event](/advanced/events) after every change, so one set of listeners covers your admin UI, seed
scripts and the CLI alike.

## What the events contain

| Event | Payload |
| --- | --- |
| `role.attached` / `role.detached` | `{ subject, roles, guardName, teamId }` |
| `permission.attached` / `permission.detached` | `{ target: 'subject', subject }` or `{ target: 'role', role }`, plus `{ permissions, guardName, teamId }` |
| `role.created` / `role.deleted` | `{ role, teamId }` |
| `permission.created` / `permission.deleted` | `{ permission }` |

Every payload also has `event`, its name, and `actor`, who made the change, when the engine knows it. `roles` and
`permissions` only list what actually changed.

## 1. Tell the engine who acts

The engine doesn't know the current user by itself. Give it a `getActor` function that reads it from the request,
here through an `AsyncLocalStorage`:

```ts
// audit-context.ts
import { AsyncLocalStorage } from 'node:async_hooks'
import type { RbacActor } from '@anievo-id/rbac-evolution'

export const auditContext = new AsyncLocalStorage<RbacActor>()
```

```ts
// rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { auditContext } from './audit-context'

export const rbac = createRbac({
  adapter,
  getActor: () => auditContext.getStore(), // every event of this request carries it as `actor`
})
```

```ts
// app.ts (Express), after your authentication
app.use((req, res, next) => {
  if (!req.user) return next()
  auditContext.run({ type: 'user', id: req.user.id }, next)
})
```

Changes made outside a request have no context. Name the actor on the call instead, it wins over `getActor`:

```ts
await rbac.sync(seed, { actor: 'seed' })              // every write of the sync
await rbac.for(user, { actor: 'cli' }).assignRole('admin')
```

Without either, the event has no `actor` and the log records `system`. In a runtime without `AsyncLocalStorage`,
pass `actor` on the calls: `rbac.for(user, { actor: currentUser })`.

## 2. Write every event to a table

```ts
// audit.ts
import type { RbacActor, RbacEvent, RbacEventName } from '@anievo-id/rbac-evolution'
import { rbac } from './rbac'
import { db } from './db'

const names = (items: { name: string }[]) => items.map((i) => i.name)
const actorOf = (actor: RbacActor | undefined) =>
  actor === undefined ? 'system' : typeof actor === 'string' ? actor : `${actor.type}:${actor.id}`

function describe(e: RbacEvent) {
  switch (e.event) {
    case 'role.attached':
    case 'role.detached':
      return { target: `${e.subject.type}:${e.subject.id}`, items: names(e.roles), teamId: e.teamId }
    case 'permission.attached':
    case 'permission.detached':
      return {
        target: e.target === 'role' ? `role:${e.role.name}` : `${e.subject.type}:${e.subject.id}`,
        items: names(e.permissions),
        teamId: e.teamId,
      }
    case 'role.created':
    case 'role.deleted':
      return { target: `role:${e.role.name}`, items: [], teamId: e.teamId }
    case 'permission.created':
    case 'permission.deleted':
      return { target: `permission:${e.permission.name}`, items: [], teamId: null }
  }
}

async function record(e: RbacEvent): Promise<void> {
  const { target, items, teamId } = describe(e)
  try {
    await db.auditLog.create({
      data: {
        action: e.event,
        actor: actorOf(e.actor),
        target,
        items: items.join(', '),
        teamId: teamId === null ? null : String(teamId),
      },
    })
  } catch (error) {
    console.error('audit log failed', error) // never turn a saved change into a failed request
  }
}

const events: RbacEventName[] = [
  'role.attached', 'role.detached', 'permission.attached', 'permission.detached',
  'role.created', 'role.deleted', 'permission.created', 'permission.deleted',
]
for (const name of events) rbac.on(name, record)
```

`db.auditLog` stands for your own table: `action`, `actor`, `target`, `items`, `team_id` and a `created_at` that
defaults to now. Import `audit.ts` once at startup.

## 3. Alert on privileged roles

```ts
const PRIVILEGED = new Set(['super-admin', 'owner'])

rbac.on('role.attached', async ({ subject, roles, teamId, actor }) => {
  const granted = roles.filter((r) => PRIVILEGED.has(r.name))
  if (granted.length === 0) return
  const by = actor === undefined ? 'system' : typeof actor === 'string' ? actor : `${actor.type}:${actor.id}`
  await alerts.send(`${subject.type}:${subject.id} got ${names(granted).join(', ')} from ${by} (team ${teamId ?? '-'})`)
})
```

`alerts.send` is your own notifier (Slack, e-mail, a pager).

## Good to know

- **The change is already saved** when a listener runs. Listeners can't block a change; check permissions before
  you call the engine.
- **The caller waits.** Listeners are awaited one by one, so a slow listener makes `assignRole()` slow. For slow
  work, put a job on a queue in the listener.
- **Errors reach the caller.** That is why `record` catches its own errors.
- **Deletes are one event.** Deleting a role emits `role.deleted` only, not a `role.detached` for every user who
  had it.
- **Only this process.** Listeners see changes made through this `rbac` instance. Raw SQL and other services don't
  emit events.

See [Events](/advanced/events) for the ordering rules and [Production](/best-practices/production) for the rest of
the checklist.

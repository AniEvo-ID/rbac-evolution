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

Every payload also has `event`, its name. `roles` and `permissions` only list what actually changed.

The events say **what** changed, not **who** changed it. The engine doesn't know the current user, so the recipe
keeps it in an `AsyncLocalStorage`.

## 1. Remember the actor per request

```ts
// audit-context.ts
import { AsyncLocalStorage } from 'node:async_hooks'

export const auditContext = new AsyncLocalStorage<{ actorId: string }>()
```

```ts
// app.ts (Express), after your authentication
app.use((req, res, next) => {
  if (!req.user) return next()
  auditContext.run({ actorId: String(req.user.id) }, next)
})
```

Changes made outside a request (a seed script, the CLI) have no actor. The log records them as `system`.

## 2. Write every event to a table

```ts
// audit.ts
import type { RbacEvent, RbacEventName } from '@anievo-id/rbac-evolution'
import { rbac } from './rbac'
import { auditContext } from './audit-context'
import { db } from './db'

const names = (items: { name: string }[]) => items.map((i) => i.name)

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
        actor: auditContext.getStore()?.actorId ?? 'system',
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

rbac.on('role.attached', async ({ subject, roles, teamId }) => {
  const granted = roles.filter((r) => PRIVILEGED.has(r.name))
  if (granted.length === 0) return
  await alerts.send(`${subject.type}:${subject.id} got ${names(granted).join(', ')} (team ${teamId ?? '-'})`)
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

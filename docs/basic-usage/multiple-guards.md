# Multiple guards

A guard is a separate namespace for roles and permissions. Laravel uses guards for different authentication systems, and RBAC Evolution borrows the idea: for example, people signing in to your web app (`web`) and machine clients calling your API (`api`) can each have their own roles and permissions, even with the same names.

If your app has only one kind of access, you can ignore guards completely. Everything uses the default guard, `web`.

## The default guard

```ts
createRbac({ adapter })                       // default guard: 'web'
createRbac({ adapter, defaultGuard: 'api' })  // change it
```

Every call that doesn't name a guard uses the default.

## Using another guard

Pass `{ guard }` when creating, finding or deleting:

```ts
await rbac.createPermission('edit articles', { guard: 'api' })
await rbac.createRole('integration', { guard: 'api' })

await rbac.findPermission('edit articles', { guard: 'api' })
await rbac.getRoles({ guard: 'api' })
await rbac.deleteRole('integration', { guard: 'api' })
```

And when scoping to a role or a subject:

```ts
await rbac.role('integration', { guard: 'api' }).givePermissionTo('edit articles')

const client = { type: 'client', id: 'c_9f1c' }
await rbac.for(client, { guard: 'api' }).assignRole('integration')
await rbac.for(client, { guard: 'api' }).can('edit articles') // true
```

## Guards are separate

The same name in two guards means two different records:

```ts
await rbac.createPermission('edit articles')                     // web
await rbac.createPermission('edit articles', { guard: 'api' })   // api, a separate permission
```

A subject's roles and permissions are checked per guard. What it has in `web` doesn't count in `api`:

```ts
await rbac.for(user).givePermissionTo('edit articles') // web

await rbac.for(user).can('edit articles')                    // true
await rbac.for(user, { guard: 'api' }).can('edit articles') // false
```

Writes are per guard too: `syncRoles()` and `revokeAll()` only touch the current guard. Pass
`revokeAll({ allGuards: true })` to clear a subject in every guard at once.

## Mixing guards

Names are always looked up in the guard you are working in. If you pass a role or permission **object** from another guard, the engine throws `GuardDoesNotMatch`:

```ts
const apiPermission = await rbac.findPermissionOrFail('edit articles', { guard: 'api' })

await rbac.role('writer').givePermissionTo(apiPermission) // throws GuardDoesNotMatch
```

A role always works in its own guard, so `rbac.role(roleObject)` uses the role's `guardName` and ignores the `guard` option.

## Typed names per guard

[Typed names](/basic-usage/typed-names) can be per guard too: type the names of each guard under `guards`, and the
compiler checks every name against the guard you work in. A permission that exists only in `api` is then a type
error on a `web` subject, and the other way round.

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

type AppRbac = {
  guards: {
    web: { roles: 'writer' | 'admin'; permissions: 'edit articles' }
    api: { roles: 'integration'; permissions: 'read articles' | 'edit articles' }
  }
  defaultGuard: 'web'
}

const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
const client = { type: 'client', id: 'c_9f1c' }

await rbac.createRole('integration', { guard: 'api' })
await rbac.role('integration', { guard: 'api' }).givePermissionTo('read articles')
await rbac.for(client, { guard: 'api' }).assignRole('integration')
await rbac.for(client, { guard: 'api' }).assignRole('admin') // type error: `admin` is a `web` role
await rbac.for(client).withScope({ guard: 'api' }).can('read articles')
```

`rbac.for(subject)` takes the default guard's names; `{ guard }` (on `for()`, `withScope()`, `role()`,
`createRole()`, `createPermission()`, `find*()`, ...) takes that guard's names; `sync()` checks each block
against its own `guard`. Pass `guard` as a literal: a `string` variable accepts the names of every guard. The
guards of the integrations narrow the same way, by the request's guard and the route's `{ guard }` option.
See [Typed names: names per guard](/basic-usage/typed-names#names-per-guard).

## With the integrations

The Express middleware, the Next.js helpers and the CLI accept a guard too (`guard` option or `--guard` flag). See [Express](/frameworks/express), [Next.js](/frameworks/nextjs) and [CLI](/basic-usage/cli). With [typed names per guard](#typed-names-per-guard), the names a route guard accepts follow its guard: `createGuards<AppRbac, 'api'>()` for the routes of an `api` middleware, and `{ guard: 'api' }` per route.

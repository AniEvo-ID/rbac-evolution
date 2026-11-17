# Typed names (enums)

Role and permission names are strings, and a typo in a string is easy to miss. In TypeScript you can tell the engine which names are valid, and the compiler will catch mistakes for you. This is the JS counterpart of using PHP enums with spatie.

## With a union type

Pass a type argument to `createRbac`:

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

type AppRbac = {
  permissions: 'edit articles' | 'delete articles' | 'publish articles'
  roles: 'writer' | 'editor' | 'admin'
}

export const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
```

Now every name you pass in is checked:

```ts
await rbac.for(user).can('edit articles')   // ok
await rbac.for(user).can('edit artcles')    // type error
await rbac.for(user).assignRole('ghost')    // type error
await rbac.createRole('editor')             // ok
```

Both keys are optional. A missing key accepts any string:

```ts
const rbac = createRbac<{ permissions: 'edit articles' | 'delete articles' }>({ adapter })
// role names: any string
```

## With a TypeScript enum

String enums work too. You can then pass either the enum member or its value:

```ts
enum Permission {
  EditArticles = 'edit articles',
  DeleteArticles = 'delete articles',
}

enum Role {
  Writer = 'writer',
  Admin = 'admin',
}

const rbac = createRbac<{ permissions: Permission; roles: Role }>({ adapter })

await rbac.role(Role.Writer).givePermissionTo(Permission.EditArticles)
await rbac.for(user).can(Permission.EditArticles) // ok
await rbac.for(user).can('edit articles')         // ok, same value
```

A neat side effect: seeding becomes a loop over the enum.

<!-- doc-test: skip -->
```ts
for (const name of Object.values(Permission)) {
  await rbac.findOrCreatePermission(name)
}
```

## What is checked

- **Inputs are typed everywhere**: `createPermission`, `createRole`, `findRole`, `findOrCreatePermission`, `role()`, `givePermissionTo`, `assignRole`, `can`, `hasRole`, `hasPermissionTo`, `subjectsWithRole`, `superAdminRoles`, and so on.
- **`Permission` and `Role` objects are always accepted**, whatever their name.
- **Return values stay `string[]`.** `getRoleNames()`, `getPermissionNames()` and `snapshot()` return plain strings, because the database may contain names your code doesn't know about.

## In guards, middleware and the CLI

The server integrations check names against the same type, so a typo in a route guard is a compile error too.
Pipe lists (`'edit articles|delete articles'`) are checked part by part.

```ts
// Express, Fastify, Hono, Elysia: pass the type to createGuards
const { requirePermission, requireRole } = createGuards<AppRbac>()
app.put('/articles/:id', requirePermission('edit articles|publish articles'), handler) // ok
app.delete('/articles/:id', requirePermission('delete artcles'), handler) // type error

// NestJS: typed decorators
export const { RequirePermissions, RequireRoles } = createRbacDecorators<AppRbac>()

// Next.js and Nuxt: the names come from the engine you pass in
const nextRbac = createNextRbac({ rbac, getSubject })
await nextRbac.requirePermission('edit artcles') // type error

// CLI: `seed` in rbac.config.ts is checked against `rbac`
export default defineConfig({ rbac, seed: { permissions: ['edit articles'] } })
```

The type error names the part that is wrong, for example `UnknownRequirementName<"delete artcles">`. A guard with
no names, or with its options before a name, is a type error as well, because it would fail at runtime.

The guards exported directly by each package (`import { requirePermission } from ...`) still accept any string.
Client-side helpers (`<Can>`, `useCan()`, `v-can`) take plain strings, because the snapshot they read comes from the
server.

### The request's subject

The subject each integration puts on the request (`req.rbac`, `c.var.rbac`, ...) can have the names too, so a
check inside a handler is typed like a call on the engine:

| Integration | How the names get there |
| --- | --- |
| Express, Fastify | Register the engine once (`interface RbacRegister { rbac: typeof rbac }`), or type a handler's request as `RbacRequest<typeof rbac>`. |
| Hono | `RbacVariables<typeof rbac>` / `RbacEnv<typeof rbac>` in the app's env; `rbacMiddleware({ rbac })` infers them. |
| Elysia | `rbacPlugin({ rbac })` infers them for `rbac` in the context. |
| NestJS | `@CurrentRbac() access: SubjectRbac<AppRbac>`, or `getRbac<AppRbac>(context)`. |
| Next.js, Nuxt | Inferred from `rbac`: the helpers return a `SubjectRbac<AppRbac>`. |
| SvelteKit | `interface Locals extends RbacLocals<AppRbac>` in `src/app.d.ts`; `createGuards<AppRbac>()` guards return a `SubjectRbac<AppRbac>`. |

The options of every integration (`RbacMiddlewareOptions`, `RbacPluginOptions`, `RbacModuleOptions`, ...) are
generic over the engine and infer `T` from `rbac`. Express and Fastify type the request globally, through module
augmentation, so the engine you pass can't reach `req` by itself: that is what `RbacRegister` is for. See each
framework page for the details.

```ts
// Express: once per app
declare module '@anievo-id/rbac-evolution-express' {
  interface RbacRegister {
    rbac: typeof rbac
  }
}
```

Without any of this, the request's subject accepts any name, as before.

::: warning Wildcards
With `wildcard: true`, the names you *check* must be in the union too, not just the ones you store:

```ts
type AppRbac = {
  permissions: 'articles.*' | 'articles.edit' | 'articles.delete'
}
```
:::

## Checking user input

The types only exist at compile time. A role name in a request body is a plain `string` (or anything else), and an
unknown name makes `assignRole()` / `syncRoles()` throw `RoleDoesNotExist`, which is usually a 500. To check input
against your names, give the engine the names as values too, and use the type guards `isRoleName()` and
`isPermissionName()`:

```ts
import { createRbac, isRoleName } from '@anievo-id/rbac-evolution'

const roles = ['writer', 'editor', 'admin'] as const
const permissions = ['edit articles', 'delete articles', 'publish articles'] as const

// One source of truth: the type comes from the lists, so they can't drift apart.
type Names = { roles: (typeof roles)[number]; permissions: (typeof permissions)[number] }

const rbac = createRbac<Names>({ adapter, names: { roles, permissions } })

async function setRole(userId: number, input: unknown) {
  if (!isRoleName(rbac, input)) return { status: 422, error: 'Unknown role' }
  await rbac.for({ type: 'user', id: userId }).assignRole(input) // input: 'writer' | 'editor' | 'admin'
  return { status: 200 }
}
```

`isRoleName(rbac, value)` is `true` when `value` is one of `names.roles`, and narrows it to `RoleName<T>`.
`isPermissionName(rbac, value)` does the same with `names.permissions`. For a list, `input.every((name) =>
isRoleName(rbac, name))` narrows the whole array (TypeScript 5.5 and later infer that from the arrow; before 5.5,
annotate it: `(name): name is RoleName<Names> => isRoleName(rbac, name)`).

What they check, and what they don't:

- **The list you passed, not the database.** They are synchronous, so they can narrow a type, and they cost no
  query. A role that is in the list but was never created still passes (and `assignRole()` then throws, as it should
  for a seed that did not run). To ask the database, use `findRole()` / `findPermission()`.
- **Exact names.** No wildcards, no pipes, no trimming or case folding: `'Admin'`, `' admin'` and `'admin|editor'`
  are rejected. With `wildcard: true`, `'articles.*'` passes only if it is in the list.
- **One list per engine**, like flat typed names: without `names.guards` they do not look at guards or teams.
  With [names per guard](#checking-user-input-per-guard), give each guard its own list.
- **The engine needs the list.** Without `names.roles`, `isRoleName()` throws a `TypeError`: a guard that passes
  everything (or nothing) would hide the mistake.

With string enums, pass `Object.values(...)`: `names: { roles: Object.values(Role) }`. Each entry is checked
against the typed names, but the compiler can't check that the list is complete. Deriving the type from the list,
as above, makes it complete by construction.

## Names per guard

With [several guards](/basic-usage/multiple-guards), each guard usually has its own names: people in `web` manage API
keys, API keys in `api` read orders. With one `permissions` union, `rbac.for(key, { guard: 'api' })` accepts the
`web` names too, and a `web` permission on an `api` route compiles and only fails at runtime. Since 1.2 you can type
the names of each guard instead, with `guards`:

```ts
// src/rbac.ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export type AppRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web' // optional when it is 'web'; must match createRbac({ defaultGuard })
}

export const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
```

The names then follow the guard in use:

```ts
import { rbac } from './rbac'

const key = { type: 'api_key', id: 'k_1' }

await rbac.for(user).can('articles.edit')                        // the default guard: `web` names
await rbac.for(key, { guard: 'api' }).can('orders.read')         // `api` names
await rbac.for(key, { guard: 'api' }).can('api-keys.manage')     // type error: a `web` permission
await rbac.for(user).withScope({ guard: 'api' }).hasRole('read-only')
await rbac.role('read-only', { guard: 'api' }).givePermissionTo('orders.read')
await rbac.createRole('full-access', { guard: 'api' })
await rbac.createPermission('orders.write', { guard: 'api' })
await rbac.createRole('admin', { guard: 'api' })                 // type error: a `web` role
rbac.for(key, { guard: 'apii' })                                 // type error: not a typed guard
```

`sync()` checks each block against the names of its own `guard`. A block without `guard` takes the `guard` option
of `sync()`, else the default guard:

```ts
import { rbac } from './rbac'

await rbac.sync([
  { permissions: ['articles.edit', 'api-keys.manage'], roles: { admin: '*', editor: ['articles.edit'] } },
  { guard: 'api', permissions: ['orders.read', 'orders.write'], roles: { 'read-only': ['orders.read'] } },
])
await rbac.sync({ guard: 'api', roles: { admin: '*' } }) // type error: `admin` is a `web` role
```

The error says which names the guard has:

```text
Argument of type '"api-keys.manage"' is not assignable to parameter of type
'PermissionInput<"orders.read" | "orders.write">'.
```

How it works, and its limits:

- **`guard` must be a literal** for the names to narrow. A `string` variable is accepted too, and then the names of
  every guard are: `rbac.for(key, { guard: input })` takes `articles.edit` and `orders.read` alike. An unknown
  literal is a type error that lists the typed guards. `sync()` blocks need a literal `guard`.
- **The default guard** is `defaultGuard` of the type (`'web'` without it). Set the same value in
  `createRbac({ defaultGuard })`: the option only accepts that guard.
- **A guard can leave a key out.** `api: { permissions: ... }` without `roles` accepts any role name in `api`, as
  a flat config does.
- **The top-level `roles` / `permissions` are not used** with `guards`. Flat configs (`{ roles; permissions }`)
  work exactly as before, and every guard has the same names there.
- **Names that span guards** take the names of every guard: `superAdminRoles`, and the subject of the `before`
  hook (`BeforeContext<AppRbac>`), which runs for every guard.
- **Role objects keep their own guard** at runtime. `rbac.role(roleObject)` is typed with the default guard's
  names; pass `{ guard }` to type it for another guard.
- **A per-guard engine is not an untyped `Rbac`.** Like a flat config that only has `roles`, `Rbac<AppRbac>` can't
  be assigned to `Rbac` (which means `Rbac<DefaultRbacTypes>`). Write generic code as `Rbac<T>` or
  `Rbac<RbacTypeConfig>`, and when you pass an integration its env or request type explicitly, pass the engine
  type too: `rbacMiddleware<AppEnv, AppRbac>(...)`.

### In the integrations

The guards of every integration check names in the guard they run in: the request's guard, or the route's
`{ guard }` option.

| Integration | Names of the request's guard | Another guard per route |
| --- | --- | --- |
| Express, Fastify, Hono, Elysia | `createGuards<AppRbac, 'api'>()` (the default guard without the second argument) | `requirePermission('orders.read', { guard: 'api' })` |
| NestJS | `createRbacDecorators<AppRbac, 'api'>()`, `getRbac<AppRbac, 'api'>(context)` | `@RequirePermissions('orders.read', { guard: 'api' })` |
| Next.js | `createNextRbac({ rbac, guard: 'api', getSubject })` | `can('orders.read', { guard: 'api' })` |
| Nuxt | `createRbacServer({ rbac, guard: 'api', getSubject })` | `requirePermission(event, 'orders.read', { guard: 'api' })` |
| SvelteKit | `createGuards<AppRbac, 'api'>()`, `RbacLocals<AppRbac, 'api'>` | `requirePermission(event, 'orders.read', { guard: 'api' })` |
| CLI | `seed` in `defineConfig()` is checked block by block, like `sync()` | |

```ts
import { createGuards } from '@anievo-id/rbac-evolution-express'
import type { AppRbac } from './rbac'

const web = createGuards<AppRbac>() // routes behind rbacMiddleware({ rbac, getSubject })
const api = createGuards<AppRbac, 'api'>() // routes behind rbacMiddleware({ rbac, guard: 'api', getSubject })

app.get('/settings/keys', web.requirePermission('api-keys.manage'), handler)
app.get('/v1/orders', api.requirePermission('orders.read'), handler)
app.get('/v1/keys', api.requirePermission('api-keys.manage'), handler) // type error: a `web` permission
app.get('/admin/orders', web.requirePermission('orders.read', { guard: 'api' }), handler) // checked in `api`
```

The second type argument only tells the types which guard the requests have. At runtime the middleware's `guard`
decides, as before. The request's subject has the names of a guard too: `RbacRequest<typeof rbac, Request, 'api'>`
(Express, Fastify), `RbacEnv<typeof rbac, 'api'>` (Hono, which infers it from `rbacMiddleware({ guard: 'api' })`),
`SubjectRbac<AppRbac, 'api'>` (NestJS's `@CurrentRbac()`). A registered `RbacRegister` types the global `req.rbac`
with the default guard's names.

### Checking user input per guard

`isRoleName()` and `isPermissionName()` take a `guard` too. Give the engine a list per guard in `names.guards`:

```ts
import { createRbac, isPermissionName, MemoryAdapter } from '@anievo-id/rbac-evolution'

const scopes = ['orders.read', 'orders.write'] as const

type ApiRbac = {
  guards: {
    web: { roles: 'admin'; permissions: 'api-keys.manage' }
    api: { roles: 'read-only'; permissions: (typeof scopes)[number] }
  }
}

const engine = createRbac<ApiRbac>({ adapter: new MemoryAdapter(), names: { guards: { api: { permissions: scopes } } } })

async function setScopes(keyId: string, input: unknown[]) {
  if (!input.every((name) => isPermissionName(engine, name, { guard: 'api' }))) return { status: 422 }
  await engine.for({ type: 'api_key', id: keyId }, { guard: 'api' }).syncPermissions(input) // the `api` names
  return { status: 200 }
}
```

`isPermissionName(rbac, value, { guard: 'api' })` checks the `api` list and narrows to the `api` names; without
`guard`, it checks the default guard's list. A guard without a list of its own uses the top-level `names.roles` /
`names.permissions`; with neither, it throws a `TypeError`.

## Helper types

These types are exported if you need the name types elsewhere, for example in your own wrappers:

```ts
import type { PermissionName, RoleName, RbacTypeConfig } from '@anievo-id/rbac-evolution'

type AppPermission = PermissionName<AppRbac> // 'edit articles' | 'delete articles' | ...
type AppRole = RoleName<AppRbac>             // 'writer' | 'editor' | 'admin'
```

With [names per guard](#names-per-guard), they take a guard as second argument (the default guard's names without
it, every guard's with `string`), and `GuardName<T>` lists the typed guards:

```ts
import type { GuardName, PermissionName, RoleName } from '@anievo-id/rbac-evolution'
import type { AppRbac } from './rbac' // the per-guard type of "Names per guard"

type ApiScope = PermissionName<AppRbac, 'api'> // 'orders.read' | 'orders.write'
type AnyRole = RoleName<AppRbac, string>       // the roles of every guard
type AppGuard = GuardName<AppRbac>             // 'web' | 'api'
```

Without a type argument, everything accepts `string`. The untyped `Rbac`, `SubjectRbac` and `RoleRbac` types still work, and a typed instance can be passed where an `Rbac` is expected (for example to the framework integrations or the CLI config). An engine with [names per guard](#names-per-guard) is an `Rbac<RbacTypeConfig>` instead.

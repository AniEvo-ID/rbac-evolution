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
// Express, Fastify, Hono: pass the type to createGuards
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
| NestJS | `@CurrentRbac() access: SubjectRbac<AppRbac>`, or `getRbac<AppRbac>(context)`. |
| Next.js, Nuxt | Inferred from `rbac`: the helpers return a `SubjectRbac<AppRbac>`. |

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
- **One list per engine**, like the typed names: they do not look at guards or teams.
- **The engine needs the list.** Without `names.roles`, `isRoleName()` throws a `TypeError`: a guard that passes
  everything (or nothing) would hide the mistake.

With string enums, pass `Object.values(...)`: `names: { roles: Object.values(Role) }`. Each entry is checked
against the typed names, but the compiler can't check that the list is complete. Deriving the type from the list,
as above, makes it complete by construction.

## Helper types

These types are exported if you need the name types elsewhere, for example in your own wrappers:

```ts
import type { PermissionName, RoleName, RbacTypeConfig } from '@anievo-id/rbac-evolution'

type AppPermission = PermissionName<AppRbac> // 'edit articles' | 'delete articles' | ...
type AppRole = RoleName<AppRbac>             // 'writer' | 'editor' | 'admin'
```

Without a type argument, everything accepts `string`. The untyped `Rbac`, `SubjectRbac` and `RoleRbac` types still work, and a typed instance can be passed where an `Rbac` is expected (for example to the framework integrations or the CLI config).

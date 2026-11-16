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

::: warning Wildcards
With `wildcard: true`, the names you *check* must be in the union too, not just the ones you store:

```ts
type AppRbac = {
  permissions: 'articles.*' | 'articles.edit' | 'articles.delete'
}
```
:::

## Helper types

These types are exported if you need the name types elsewhere, for example in your own wrappers:

```ts
import type { PermissionName, RoleName, RbacTypeConfig } from '@anievo-id/rbac-evolution'

type AppPermission = PermissionName<AppRbac> // 'edit articles' | 'delete articles' | ...
type AppRole = RoleName<AppRbac>             // 'writer' | 'editor' | 'admin'
```

Without a type argument, everything accepts `string`. The untyped `Rbac`, `SubjectRbac` and `RoleRbac` types still work, and a typed instance can be passed where an `Rbac` is expected (for example to the framework integrations or the CLI config).

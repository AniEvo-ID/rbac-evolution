# Quick start

This page walks through the whole flow with the in-memory adapter, so you can run it without a database. Swap `MemoryAdapter` for the [Prisma](/adapters/prisma) or [Drizzle](/adapters/drizzle) adapter when you are ready.

## 1. Create the engine

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })
```

## 2. Define permissions and roles

Permissions describe actions. Roles are named groups of permissions.

```ts
await rbac.createPermission('edit articles')
await rbac.createPermission('delete articles')
await rbac.createPermission('publish articles')

await rbac.createRole('writer')
await rbac.createRole('editor')
```

## 3. Give permissions to roles

`rbac.role(name)` returns a helper for a single role:

```ts
await rbac.role('writer').givePermissionTo('edit articles')
await rbac.role('editor').givePermissionTo('edit articles', 'delete articles', 'publish articles')
```

## 4. Assign roles to a user

Anything with a `type` and an `id` can hold roles. `rbac.for(subject)` returns a helper scoped to that subject:

```ts
const user = rbac.for({ type: 'user', id: 1 })

await user.assignRole('writer')
```

## 5. Check access

```ts
await user.hasRole('writer')             // true
await user.hasRole('editor')             // false

await user.can('edit articles')          // true  (through the writer role)
await user.can('delete articles')        // false
await user.cannot('publish articles')    // true
```

`can()` never throws. If you ask about a permission that does not exist, it returns `false`.

You can also give a permission to the user directly, without a role:

```ts
await user.givePermissionTo('publish articles')
await user.can('publish articles') // true
```

## 6. Use it in your app

A typical server-side check in a route handler:

```ts
export async function deleteArticle(currentUser: { id: number }, articleId: number) {
  if (await rbac.for({ type: 'user', id: currentUser.id }).cannot('delete articles')) {
    throw new Error('Forbidden')
  }
  // ...delete the article
}
```

To send the user's access to the browser (for React or Vue), use `snapshot()`:

```ts
await user.snapshot()
// { roles: ['writer'], permissions: ['publish articles', 'edit articles'] }
```

::: warning
Checks in the browser are for the UI only. Always check permissions on the server too.
:::

## Next steps

- [Basic usage](/basic-usage/basic-usage): subjects, finding and deleting roles and permissions
- [Permissions via roles](/basic-usage/roles) and [direct permissions](/basic-usage/direct-permissions)
- [Super-admin](/basic-usage/super-admin), [teams](/basic-usage/teams) and [wildcards](/basic-usage/wildcard-permissions)
- Framework guides: [Next.js](/frameworks/nextjs), [React](/frameworks/react), [Vue](/frameworks/vue), [Express](/frameworks/express)
- Storage: [adapters overview](/adapters/overview)

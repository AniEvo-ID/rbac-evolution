# Super-admin

Often one role should be allowed to do everything. Giving it every permission one by one is tedious and easy to forget when you add new permissions. Instead, let the engine treat it as a super-admin.

There are two tools for this: the `superAdminRoles` option for the common case, and a `before` hook for full control. Both work like Laravel's `Gate::before`.

## `superAdminRoles`

```ts
const rbac = createRbac({
  adapter,
  superAdminRoles: ['super-admin'],
})

await rbac.createRole('super-admin')
await rbac.for(root).assignRole('super-admin')

await rbac.for(root).can('edit articles') // true
await rbac.for(root).can('anything')      // true, even if the permission doesn't exist
```

A subject that has **any** of the listed roles (in the current guard and team) passes every `can()` check. The role itself needs no permissions.

## The `before` hook

For anything more specific, add a `before` hook. It receives the scoped subject and the permission name, and returns:

- `true` to allow,
- `false` to deny,
- `undefined` to continue with the normal checks.

```ts
const rbac = createRbac({
  adapter,
  superAdminRoles: ['super-admin'],
  before: async ({ subject, permission }) => {
    // nobody may do this, not even super-admins
    if (permission === 'delete everything') return false

    // block banned users entirely
    if (await isBanned(subject.subject.id)) return false

    // anything else: fall through
    return undefined
  },
})
```

`subject` is the same helper that `rbac.for()` returns. It has `subject` (the `{ type, id }` object), `guardName`, `teamId`, and methods like `hasRole()`:

<!-- doc-test: skip -->
```ts
before: async ({ subject }) => {
  if (subject.guardName === 'web' && (await subject.hasRole('owner'))) return true
  return undefined
}
```

::: warning
Return `undefined` (or nothing) when the hook has no opinion. Returning `false` denies the permission, even to super-admins.
:::

## Order of evaluation

For each `can()` check:

1. `before` runs. If it returns `true` or `false`, that is the answer.
2. Otherwise, if the subject has one of the `superAdminRoles`, the answer is `true`.
3. Otherwise, the normal permission check runs (direct permissions and permissions via roles).

## Which methods use it

Only the authorization checks go through `before` and `superAdminRoles`. Everything else looks at the stored data only. This matches spatie, where only `can()` goes through the Gate.

| Uses `before` / `superAdminRoles` | Data only |
| --- | --- |
| `can()` | `hasPermissionTo()` |
| `cannot()` | `hasDirectPermission()` |
| `canAny()` | `hasAnyPermission()` |
| `canAll()` | `hasAllPermissions()` |
| | `hasRole()`, `hasAnyRole()`, `hasAllRoles()`, `hasExactRoles()` |
| | `getAllPermissions()`, `getPermissionNames()`, `snapshot()` (runs `before` only for `checkBefore` names) |

```ts
await rbac.for(root).can('edit articles')             // true
await rbac.for(root).hasPermissionTo('edit articles') // false: nothing is stored
```

::: tip
Use `can()` for "is this allowed?" and `hasPermissionTo()` for "what has been granted?". An admin screen that lists a user's permissions should use the data methods. A route guard should use `can()`.
:::

## Super-admins in the browser

`snapshot()` contains only stored data, so a super-admin's snapshot may have no permissions at all. Tell the client which roles are super-admin roles so the UI agrees with the server. Both UI packages accept `superAdminRoles`:

::: code-group

```tsx [React]
<RbacProvider snapshot={snapshot} superAdminRoles={['super-admin']}>
  {children}
</RbacProvider>
```

```ts [Vue]
createRbacPlugin({ snapshot, superAdminRoles: ['super-admin'] })
```

:::

### Denials from `before`

The `before` hook runs on the server only, so with `superAdminRoles` alone a super-admin's UI shows everything,
including what the hook denies to everyone. Pass the names your UI checks to `snapshot({ checkBefore })`: the hook
runs for each of them, and the ones it denies are sent in `denied`. Both UI packages treat those as not allowed,
even for a super-admin, the same order the server uses (`before` first).

```ts
const rbac = createRbac({
  adapter,
  superAdminRoles: ['super-admin'],
  before: ({ permission }) => (permission === 'delete everything' ? false : undefined),
})

const snapshot = await rbac.for(root).snapshot({ checkBefore: ['delete everything', 'edit articles'] })
// { roles: ['super-admin'], permissions: [], denied: ['delete everything'] }
```

::: code-group

```tsx [React]
<RbacProvider snapshot={snapshot} superAdminRoles={['super-admin']}>
  {children} {/* <Can permission="delete everything"> renders nothing */}
</RbacProvider>
```

```ts [Vue]
createRbacPlugin({ snapshot, superAdminRoles: ['super-admin'] }).can('delete everything') // false
```

:::

- Only denials travel. A hook that **allows** through custom logic (returns `true`) is not visible in the browser.
- `denied` holds the exact names you listed; it doesn't match wildcards.
- `checkBefore` is optional. Without it the snapshot has no `denied`, and older snapshots behave as before.

See [React](/frameworks/react) and [Vue](/frameworks/vue).

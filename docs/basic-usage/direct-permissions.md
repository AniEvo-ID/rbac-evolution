# Direct permissions

Most of the time permissions should come from roles. Sometimes a single user needs one extra permission, though, and creating a role just for that is overkill. For those cases you can give permissions straight to a subject.

::: tip
Prefer roles where you can. Direct permissions are harder to audit because they are spread across individual users. See [Roles vs permissions](/best-practices/roles-vs-permissions).
:::

## Giving and revoking

The permission must exist first:

```ts
await rbac.createPermission('publish articles')

const user = rbac.for({ type: 'user', id: 1 })

await user.givePermissionTo('publish articles')
await user.revokePermissionTo('publish articles')
```

Several at once, as arguments or an array:

```ts
await user.givePermissionTo('edit articles', 'publish articles')
await user.givePermissionTo(['edit articles', 'publish articles'])
```

Giving a permission the subject already has does nothing. Revoking one it doesn't have does nothing either. Using a name that doesn't exist throws `PermissionDoesNotExist`.

## Syncing

`syncPermissions()` replaces all of the subject's direct permissions with the given list. Permissions it gets through roles are not touched.

```ts
await user.syncPermissions('edit articles', 'publish articles')

await user.syncPermissions() // remove all direct permissions
```

## Checking

There are three kinds of checks:

```ts
// Authorization check: honors `before` and superAdminRoles, never throws
await user.can('publish articles')

// Data check, direct permissions or via roles; throws if the permission doesn't exist
await user.hasPermissionTo('publish articles')

// Data check, direct permissions only; throws if the permission doesn't exist
await user.hasDirectPermission('publish articles')
```

For several permissions at once:

```ts
await user.canAny('edit articles', 'publish articles')
await user.canAll(['edit articles', 'publish articles'])

await user.hasAnyPermission('edit articles', 'publish articles')
await user.hasAllPermissions('edit articles', 'publish articles')
```

`hasAnyPermission()` and `hasAllPermissions()` are data checks like `hasPermissionTo()`, but they never throw: an unknown permission simply counts as missing.

## Reading permissions

```ts
await user.getDirectPermissions()   // Permission[] given directly
await user.getPermissionsViaRoles() // Permission[] inherited from roles
await user.getAllPermissions()      // both, without duplicates
await user.getPermissionNames()     // both, as names: ['edit articles', ...]
```

## Scope

Direct permissions are stored per [guard](/basic-usage/multiple-guards) and, when teams are enabled, per [team](/basic-usage/teams):

```ts
await rbac.for(user, { team: 42 }).givePermissionTo('publish articles')

await rbac.for(user, { team: 42 }).can('publish articles') // true
await rbac.for(user, { team: 7 }).can('publish articles')  // false
```

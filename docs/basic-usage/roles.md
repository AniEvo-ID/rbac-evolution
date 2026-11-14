# Permissions via roles

A role is a named group of permissions. Give permissions to the role once, then assign the role to as many subjects as you like. When the role changes, everyone who has it is affected.

## Giving permissions to a role

Use `rbac.role()` to work with a single role:

```ts
await rbac.createPermission('edit articles')
await rbac.createPermission('delete articles')
await rbac.createRole('writer')

const writer = rbac.role('writer')

await writer.givePermissionTo('edit articles', 'delete articles')
await writer.revokePermissionTo('delete articles')
await writer.syncPermissions(['edit articles']) // replace all permissions of the role
```

`rbac.role()` accepts a name or a `Role` object. It doesn't query anything until you call a method; an unknown role name throws `RoleDoesNotExist` at that point.

Reading and checking:

```ts
await writer.getPermissions()                // Permission[]
await writer.getPermissionNames()            // ['edit articles']
await writer.hasPermissionTo('edit articles') // true
await writer.get()                           // the Role object, or throws RoleDoesNotExist
```

## Assigning roles

```ts
const user = rbac.for({ type: 'user', id: 1 })

await user.assignRole('writer')
await user.assignRole('writer', 'editor')
await user.assignRole(['writer', 'editor'])

await user.removeRole('editor')
```

Assigning a role the subject already has is a no-op. An unknown role name throws `RoleDoesNotExist`.

### Syncing roles

`syncRoles()` makes the given roles the subject's only roles:

```ts
await user.syncRoles('editor')     // now only 'editor'
await user.syncRoles(['a', 'b'])   // now only 'a' and 'b'
await user.syncRoles()             // no roles at all
```

Syncing only affects roles in the current [guard](/basic-usage/multiple-guards) and [team](/basic-usage/teams).

From the role's side, `syncSubjects()` makes the given subjects of one type the role's only holders
(spatie `Role::syncModels()`). Other subject types keep the role. `role.attached` / `role.detached` events fire per subject.

```ts
await rbac.role('editor').syncSubjects('user', [2, 7]) // only users 2 and 7 are editors now
```

## Checking roles

```ts
await user.hasRole('writer')                 // has this role
await user.hasRole(['writer', 'editor'])     // has ANY of these roles

await user.hasAnyRole('writer', 'editor')    // has at least one
await user.hasAllRoles('writer', 'editor')   // has both
await user.hasExactRoles('writer', 'editor') // has both, and no other role
```

Role checks never throw. A role that doesn't exist is simply not one the subject has.

::: info
Role checks are data checks. They are not affected by the [`before` hook or super-admin roles](/basic-usage/super-admin).
:::

## Reading roles

```ts
await user.getRoleNames() // ['writer', 'editor']
await user.getRoles()     // Role[]
```

## Checking permissions that come from roles

Permission checks look at direct permissions and at the permissions of all the subject's roles:

```ts
await rbac.role('writer').givePermissionTo('edit articles')
await user.assignRole('writer')

await user.can('edit articles')             // true
await user.hasPermissionTo('edit articles') // true
await user.hasDirectPermission('edit articles') // false: it comes from a role

await user.getPermissionsViaRoles()         // [{ name: 'edit articles', ... }]
```

## Finding subjects by role

To list everyone who has a role, ask the engine for subject ids of a given type:

```ts
await rbac.subjectsWithRole('user', 'writer')             // e.g. [1, 4]
await rbac.subjectsWithRole('user', ['writer', 'editor']) // any of the roles

await rbac.subjectsWithPermission('user', 'edit articles') // directly or via a role
```

Unknown names throw `RoleDoesNotExist` / `PermissionDoesNotExist`. See [Querying subjects](/advanced/querying-subjects) for details.

# Coming from Laravel

If you know [spatie/laravel-permission](https://github.com/spatie/laravel-permission), you already know most of RBAC Evolution. This page maps the Laravel concepts to their JS equivalents.

## The main differences

- **Everything is async.** Every method that touches storage returns a promise, so use `await`.
- **No model trait.** Instead of `$user->assignRole()`, you scope the engine to a subject: `rbac.for(user).assignRole()`. A subject is a plain `{ type, id }` object, so there is nothing to add to your user model.
- **One explicit instance.** You create the engine with `createRbac({ ... })`. The options replace `config/permission.php`.
- **Guards and teams are passed per call** as `{ guard, team }` options, instead of being read from the auth guard or a global team id.

## Concepts

| Laravel / spatie | RBAC Evolution |
| --- | --- |
| `HasRoles` trait on the `User` model | `rbac.for({ type: 'user', id })` |
| `model_type` + `model_id` | `Subject`: `{ type, id }` |
| `guard_name` | `{ guard: 'api' }` option, default from `defaultGuard` |
| `setPermissionsTeamId($teamId)` | `rbac.for(user, { team: teamId })` |
| `config/permission.php` | `createRbac({ ... })` options |
| `'teams' => true` | `createRbac({ teams: true })` |
| `'enable_wildcard_permission' => true` | `createRbac({ wildcard: true })` |
| `cache.expiration_time` / `cache.store` | `cacheTtl` (ms) / `cache` (a `CacheStore`) |
| Enums for role / permission names | [Typed names](/basic-usage/typed-names): `createRbac<{ permissions: ...; roles: ... }>()` |
| `Gate::before(...)` super-admin | `before` hook and `superAdminRoles` |
| Package events (`RoleAttached`, ...) | `rbac.on('role.attached', listener)` |

## Tables

The [Prisma](/adapters/prisma) and [Drizzle](/adapters/drizzle) adapters use the same five tables as spatie:

| Table | Notes |
| --- | --- |
| `permissions` | `name`, `guard_name` |
| `roles` | `name`, `guard_name`, `team_id` |
| `role_has_permissions` | Links roles to permissions |
| `model_has_roles` | `subject_type` + `subject_id` instead of `model_type` + `model_id` |
| `model_has_permissions` | Same, for direct permissions |

## Roles and permissions

| Laravel / spatie | RBAC Evolution |
| --- | --- |
| `Permission::create(['name' => 'edit articles'])` | `rbac.createPermission('edit articles')` |
| `Role::create(['name' => 'writer'])` | `rbac.createRole('writer')` |
| `Role::create([... 'guard_name' => 'api'])` | `rbac.createRole('writer', { guard: 'api' })` |
| `Permission::findByName('edit articles')` | `rbac.findPermissionOrFail('edit articles')` (or `findPermission`, which returns `null`) |
| `Role::findByName('writer')` | `rbac.findRoleOrFail('writer')` (or `findRole`) |
| `Permission::findOrCreate(...)` / `Role::findOrCreate(...)` | `rbac.findOrCreatePermission(...)` / `rbac.findOrCreateRole(...)` |
| `Role::all()` / `Permission::all()` | `rbac.getRoles()` / `rbac.getPermissions()` |
| `$role->delete()` | `rbac.deleteRole('writer')` |
| `$role->givePermissionTo(...)` | `rbac.role('writer').givePermissionTo(...)` |
| `$role->revokePermissionTo(...)` | `rbac.role('writer').revokePermissionTo(...)` |
| `$role->syncPermissions(...)` | `rbac.role('writer').syncPermissions(...)` |
| `$role->hasPermissionTo(...)` | `rbac.role('writer').hasPermissionTo(...)` |

## Users (subjects)

| Laravel / spatie | RBAC Evolution |
| --- | --- |
| `$user->assignRole('writer')` | `rbac.for(user).assignRole('writer')` |
| `$user->removeRole('writer')` | `rbac.for(user).removeRole('writer')` |
| `$user->syncRoles([...])` | `rbac.for(user).syncRoles([...])` |
| `$user->hasRole('writer')` | `rbac.for(user).hasRole('writer')` |
| `$user->hasAnyRole(...)` / `hasAllRoles(...)` / `hasExactRoles(...)` | Same names on `rbac.for(user)` |
| `$user->givePermissionTo(...)` | `rbac.for(user).givePermissionTo(...)` |
| `$user->revokePermissionTo(...)` | `rbac.for(user).revokePermissionTo(...)` |
| `$user->syncPermissions(...)` | `rbac.for(user).syncPermissions(...)` |
| `$user->hasPermissionTo(...)` | `rbac.for(user).hasPermissionTo(...)` |
| `$user->hasDirectPermission(...)` | `rbac.for(user).hasDirectPermission(...)` |
| `$user->hasAnyPermission(...)` / `hasAllPermissions(...)` | Same names on `rbac.for(user)` |
| `$user->can(...)` / `$user->cannot(...)` | `rbac.for(user).can(...)` / `.cannot(...)` |
| `$user->canAny([...])` | `rbac.for(user).canAny([...])` (plus `canAll`) |
| `$user->getRoleNames()` | `rbac.for(user).getRoleNames()` |
| `$user->getPermissionNames()` | `rbac.for(user).getPermissionNames()` |
| `$user->getAllPermissions()` | `rbac.for(user).getAllPermissions()` |
| `$user->getDirectPermissions()` | `rbac.for(user).getDirectPermissions()` |
| `$user->getPermissionsViaRoles()` | `rbac.for(user).getPermissionsViaRoles()` |
| `Role::syncModels([...])` | `rbac.role('writer').syncSubjects('user', [...ids])` |
| `User::role('writer')->get()` | `rbac.subjectsWithRole('user', 'writer')` (returns ids) |
| `User::permission('edit articles')->get()` | `rbac.subjectsWithPermission('user', 'edit articles')` (returns ids) |

## Blade directives

| Blade | React (`-react`) | Vue (`-vue`) |
| --- | --- | --- |
| `@can('edit articles')` | `<Can permission="edit articles">` | `v-can="'edit articles'"` or `<Can permission="...">` |
| `@cannot('edit articles')` | `<Cannot permission="edit articles">` | `v-can.not="'edit articles'"` |
| `@canany([...])` | `<Can anyOf={[...]}>` | `v-can.any="[...]"` |
| `@role('admin')` | `<HasRole role="admin">` | `v-role="'admin'"` or `<HasRole role="admin">` |
| `@hasanyrole('admin\|editor')` | `<HasRole anyOf={['admin', 'editor']}>` | `v-role="'admin\|editor'"` |
| `@hasallroles('writer\|editor')` | `<HasRole allOf={['writer', 'editor']}>` | `v-role.all="['writer', 'editor']"` |
| `@unlessrole('banned')` | — | `v-role.not="'banned'"` |

Both packages work from a `snapshot()` sent by the server. See [React](/frameworks/react) and [Vue](/frameworks/vue).

## Middleware

| Laravel route middleware | Express (`-express`) | Next.js (`-next`) |
| --- | --- | --- |
| `role:admin` | `requireRole('admin')` | `requireRole('admin')` or a middleware rule `{ role: 'admin' }` |
| `permission:edit articles` | `requirePermission('edit articles')` | `requirePermission('edit articles')` or `{ permission: '...' }` |
| `role_or_permission:admin\|edit articles` | `requireRoleOrPermission('admin\|edit articles')` | `{ roleOrPermission: ['admin', 'edit articles'] }` |

See [Express](/frameworks/express) and [Next.js](/frameworks/nextjs).

## Artisan commands

| Artisan | CLI |
| --- | --- |
| `php artisan permission:create-permission "edit articles"` | `npx rbac-evolution create-permission "edit articles"` |
| `php artisan permission:create-role writer web "edit articles"` | `npx rbac-evolution create-role writer "edit articles" --guard web` |
| `php artisan permission:assign-role writer 1` | `npx rbac-evolution assign-role writer 1` |
| `php artisan permission:show` | `npx rbac-evolution show` |
| `php artisan permission:cache-reset` | `npx rbac-evolution cache-reset` |

The spatie-style names (`permission:create-role`, ...) are accepted as aliases. See [CLI](/basic-usage/cli).

## Cache and exceptions

| Laravel / spatie | RBAC Evolution |
| --- | --- |
| `app(PermissionRegistrar::class)->forgetCachedPermissions()` | `rbac.forgetCachedPermissions()` |
| `PermissionDoesNotExist` | `PermissionDoesNotExist` |
| `RoleDoesNotExist` | `RoleDoesNotExist` |
| `PermissionAlreadyExists` / `RoleAlreadyExists` | Same names |
| `GuardDoesNotMatch` | `GuardDoesNotMatch` |

All errors extend `RbacError` and have a `code` field. See [Errors](/advanced/errors).

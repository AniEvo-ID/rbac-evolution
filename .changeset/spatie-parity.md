---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-react': minor
---

More of spatie/laravel-permission's API:

- `rbac.for(user).hasAnyDirectPermission(...)` and `.hasAllDirectPermissions(...)`: direct permissions only, never throw.
- `rbac.for(user).checkPermissionTo(name)`: `hasPermissionTo` that returns `false` instead of throwing for an unknown permission or another guard.
- `rbac.for(user).withScope({ guard, team })`: the same subject in another guard or team, like passing the guard to a spatie check (`$user->hasRole('admin', 'api')`).
- `rbac.findRoleById(id, { guard })` and `rbac.findPermissionById(id, { guard })`, like `Role::findById` and `Permission::findById`.
- `rbac.rolesWithPermission(name, { guard, team })`: the roles that grant a permission, like `$permission->roles`.
- React: `<UnlessRole role="banned">`, like `@unlessrole`.

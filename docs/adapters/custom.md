# Custom adapter

To store roles and permissions somewhere the built-in adapters don't cover (TypeORM, Kysely, MikroORM, Mongoose, DynamoDB, a remote API), implement the `RbacAdapter` interface. It has 17 small async methods. The engine handles name validation, guards, teams, wildcards, caching and events before it calls them, so an adapter only stores and loads rows.

```ts
import type { RbacAdapter } from '@anievo-id/rbac-evolution'

export class MyAdapter implements RbacAdapter {
  // ...
}
```

## Types

All of these are exported from `@anievo-id/rbac-evolution`:

```ts
type Id = string | number          // your primary key type
type TeamId = Id | null            // null = global (no team)

interface Permission { id: Id; name: string; guardName: string }
interface Role { id: Id; name: string; guardName: string; teamId: TeamId }
interface Subject { type: string; id: Id }

interface FindPermissionsQuery {
  ids?: readonly Id[]
  names?: readonly string[]
  guardName?: string
}

interface FindRolesQuery {
  ids?: readonly Id[]
  names?: readonly string[]
  guardName?: string
  teamIds?: readonly TeamId[]      // may contain null (global roles)
}

interface RolePermissionLink { roleId: Id; permissionId: Id }
```

## The interface

```ts
interface RbacAdapter {
  // permissions
  createPermission(data: { name: string; guardName: string }): Promise<Permission>
  findPermissions(query?: FindPermissionsQuery): Promise<Permission[]>
  deletePermission(id: Id): Promise<void>

  // roles
  createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role>
  findRoles(query?: FindRolesQuery): Promise<Role[]>
  deleteRole(id: Id): Promise<void>

  // role ↔ permission
  getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]>
  attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void>
  detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void>

  // subject ↔ role
  getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]>
  attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void>
  detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void>

  // subject ↔ permission (direct permissions)
  getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]>
  attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void>
  detachSubjectPermissions(subject: Subject, permissionIds: readonly Id[] | undefined, teamId: TeamId): Promise<void>

  // reverse lookups
  getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]>
  getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]>
}
```

## Rules for implementers

### Finding rows

- `findPermissions()` / `findRoles()` with no query, or an empty object, return **every** row.
- Each field in the query is an extra `AND` filter. A field that is `undefined` doesn't filter.
- An **empty array** (`ids: []`, `names: []`, `teamIds: []`) matches nothing, so return `[]`. Don't treat it as "no filter".
- `teamIds` may contain `null`. `teamIds: [7, null]` means "roles of team 7 **or** global roles". The engine uses this to show global roles inside a team.
- Return fresh objects. The engine may keep them in its cache.

### Creating rows

- `createPermission` / `createRole` insert one row and return it with its new `id`.
- `createRole` receives `teamId: null` for global roles. Return the same `teamId` you stored. It may come back as a string (for example `'7'` for `7`) if your storage keeps it as text.
- Name uniqueness is **checked by the engine** before it calls `create*`. A unique index (`(name, guard_name)` for permissions, `(name, guard_name, team_id)` for roles) is still a good idea, because it catches races.

### Deleting rows

- `deletePermission(id)` must also delete that permission's links in **both** `role_has_permissions` and `model_has_permissions`.
- `deleteRole(id)` must also delete its links in `role_has_permissions` and `model_has_roles`. It must **not** delete the permissions themselves.
- Deleting an id that doesn't exist is not an error.

### Attaching links

- Every `attach*` method is **idempotent**. Attaching a link that already exists does nothing and must not throw.
- Links are scoped by `teamId`. A role given to a subject in team `1` doesn't exist for team `2` or for global (`null`).
- Subjects are matched on **both** `type` and `id`. `{ type: 'user', id: 1 }` and `{ type: 'client', id: 1 }` are different subjects.
- Treat `1` and `'1'` as the same subject id. The SQL adapters store `String(subject.id)`.

### Detaching links

- `detachRolePermissions(roleId)` with **no** ids removes every permission from the role.
- `detachSubjectRoles(subject, undefined, teamId)` and `detachSubjectPermissions(subject, undefined, teamId)` remove every link of that subject **in that team only**.
- With an id array, remove only those links. An empty array removes nothing.

### Reading links

- `getRolePermissionLinks(roleIds)` returns the links of all given roles. For `[]` it returns `[]`.
- `getSubjectRoleIds` / `getSubjectPermissionIds` return the target ids for one subject in exactly one team. The engine does its own merging of global and team data.

### Reverse lookups

- `getSubjectIdsWithRoles(type, roleIds, teamId)` returns the ids of subjects of that `type` that hold **any** of the roles in that team. The same applies to `getSubjectIdsWithPermissions` for **direct** permissions.
- Each subject id appears **once**, even if it matches several roles.
- For an empty `roleIds` / `permissionIds`, return `[]`.
- You may return the ids in their stored form. The SQL adapters return strings.

### Ids

- `Id` is `string | number`. Use whatever your database uses (auto-increment, UUID, ObjectId).
- The engine compares ids with `String(id)`, so `7` and `'7'` count as equal. Accept both forms as input where it makes sense.

## Skeleton

A starting point with every method stubbed:

```ts
import type {
  FindPermissionsQuery,
  FindRolesQuery,
  Id,
  Permission,
  RbacAdapter,
  Role,
  RolePermissionLink,
  Subject,
  TeamId,
} from '@anievo-id/rbac-evolution'

export class MyAdapter implements RbacAdapter {
  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    throw new Error('not implemented')
  }
  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    throw new Error('not implemented')
  }
  async deletePermission(id: Id): Promise<void> {
    throw new Error('not implemented')
  }

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    throw new Error('not implemented')
  }
  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    throw new Error('not implemented')
  }
  async deleteRole(id: Id): Promise<void> {
    throw new Error('not implemented')
  }

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    throw new Error('not implemented')
  }
  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    throw new Error('not implemented')
  }
  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    throw new Error('not implemented')
  }

  async getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    throw new Error('not implemented')
  }
  async attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void> {
    throw new Error('not implemented')
  }
  async detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    throw new Error('not implemented')
  }

  async getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    throw new Error('not implemented')
  }
  async attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void> {
    throw new Error('not implemented')
  }
  async detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    throw new Error('not implemented')
  }

  async getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    throw new Error('not implemented')
  }
  async getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    throw new Error('not implemented')
  }
}
```

::: tip Storing `null` teams
In a relational database, store the global team as a sentinel such as `''` instead of `NULL`. That keeps composite primary keys and unique indexes working. Convert it back to `null` when you read. The [storage conventions](/adapters/overview#storage-conventions) explain why.
:::

The source code of the built-in adapters is a good reference. `MemoryAdapter` (in `packages/core/src/adapters/memory.ts`) is short and shows every rule above.

## Validating with `runAdapterTests`

The core package ships a conformance suite at `@anievo-id/rbac-evolution/testing`. It registers a [Vitest](https://vitest.dev) `describe` block that tests every rule on this page, plus a full flow through `createRbac`.

```ts
runAdapterTests(
  name: string,
  factory: () => RbacAdapter | Promise<RbacAdapter>,
  options?: { teams?: boolean }, // default: { teams: true }
): void
```

- `factory` runs **before every test** and must return an adapter backed by **empty** storage.
- Set `teams: false` if your adapter doesn't support team-scoped data. The team-specific tests are then skipped.
- `vitest` (2.x or later) is an optional peer dependency of the core package. Install it if you use this entry point.

```ts
// my-adapter.test.ts
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { MyAdapter } from './my-adapter'
import { db, truncateRbacTables } from './test-db'

runAdapterTests('MyAdapter', async () => {
  await truncateRbacTables(db)
  return new MyAdapter(db)
})
```

Run it with `npx vitest`. The suite reports as `RbacAdapter conformance: MyAdapter`. Add your own `describe` blocks next to it for behaviour specific to your adapter (id conversion, prefixes, transactions).

See [Testing](/advanced/testing#testing-a-custom-adapter) for complete examples with PostgreSQL and SQLite.

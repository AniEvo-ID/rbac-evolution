# @anievo-id/rbac-evolution-mongoose

📖 **[Documentation](https://creation.anievo.id/rbac-evolution/adapters/mongoose)**

[Mongoose](https://mongoosejs.com) (MongoDB) storage adapter for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) — roles & permissions for JS/TS, inspired by spatie/laravel-permission.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

`mongoose` 8 or later is a peer dependency.

## Collections

Five collections mirror spatie/laravel-permission's five tables:

| Collection              | Fields                                                                    | Indexes                                              |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `permissions`           | `_id`, `name`, `guardName`, `createdAt`, `updatedAt`                      | unique `(name, guardName)`                           |
| `roles`                 | `_id`, `name`, `guardName`, `teamId`, `createdAt`, `updatedAt`            | unique `(name, guardName, teamId)`                   |
| `role_has_permissions`  | `_id`, `roleId`, `permissionId`                                           | unique `(roleId, permissionId)`, `(permissionId)`    |
| `model_has_roles`       | `_id`, `roleId`, `subjectType`, `subjectId`, `teamId`                     | unique `(subjectType, subjectId, teamId, roleId)`, `(roleId, subjectType, teamId)` |
| `model_has_permissions` | `_id`, `permissionId`, `subjectType`, `subjectId`, `teamId`               | unique `(subjectType, subjectId, teamId, permissionId)`, `(permissionId, subjectType, teamId)` |

- **Ids are ObjectIds.** Role and permission ids are returned as 24-character hex **strings**
  (`'65f1c0...'`). Ids that aren't valid ObjectId hex strings are ignored (no document could match them).
- `subjectId` is a string, so subjects may have numeric, UUID or ObjectId ids. Reverse lookups return strings.
- `teamId` is a string; `''` means "global / no team". `Role.teamId` is `null` for global roles and a **string**
  otherwise (`teamId: 1` → `'1'`).
- `createdAt` / `updatedAt` are Mongoose timestamps on `permissions` and `roles`.
- Links live in their own collections (not embedded arrays), so they stay small, indexable and easy to query in both
  directions.

## Usage

```ts
import mongoose from 'mongoose'
import { createRbac } from '@anievo-id/rbac-evolution'
import { mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'

await mongoose.connect(process.env.MONGO_URL!)

export const rbac = createRbac({ adapter: mongooseAdapter() })
```

Options:

```ts
mongooseAdapter({
  connection: conn, // a mongoose.createConnection() connection; default: mongoose.connection
  prefix: 'rbac_', // rbac_permissions, rbac_roles, ...; default: ''
})
```

Then:

```ts
await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')
await user.can('edit articles') // true
```

### Models

The models are registered on the connection under the names `rbac:<collection>` (e.g. `rbac:roles`), so they never
clash with your own `Role` or `Permission` models. Use them directly for admin screens or reports:

```ts
import { createRbacModels, MongooseRbacAdapter } from '@anievo-id/rbac-evolution-mongoose'

const models = createRbacModels({ prefix: 'rbac_' }) // registers or reuses the models
const adapter = new MongooseRbacAdapter(models)

await models.Role.find({ teamId: '' }).lean()
```

`rbacSchemas()` returns the unregistered schemas if you want to add plugins first.

### Indexes

The unique indexes enforce name uniqueness and make `attach*` safe under concurrency. With Mongoose's `autoIndex`
on (the default) the adapter waits for them before its first operation. If you turn `autoIndex` off in production,
create them once at deploy time:

```ts
import { createRbacModels, syncRbacIndexes } from '@anievo-id/rbac-evolution-mongoose'

await syncRbacIndexes(createRbacModels())
```

## Notes

- `attach*` calls are idempotent: each link is an upsert with `$setOnInsert` on its unique key; a duplicate-key
  error from a concurrent insert of the same link is ignored.
- `deleteRole` / `deletePermission` delete the link documents first, then the role / permission. They don't use a
  transaction (which would require a replica set).

## License

MIT

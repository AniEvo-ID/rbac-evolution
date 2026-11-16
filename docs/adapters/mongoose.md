# Mongoose adapter

`@anievo-id/rbac-evolution-mongoose` stores roles and permissions in MongoDB through [Mongoose](https://mongoosejs.com). It ships the Mongoose schemas and models and an adapter that uses them.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

:::

`mongoose` 8 or 9 is a peer dependency (from 1.3). MongoDB 6 or later. See [Mongoose 9](#mongoose-9) for what changes when you upgrade.

## Collections

The adapter uses five collections, one for each of the [five tables](/adapters/overview#the-five-tables) of the SQL adapters. Field names follow the usual Mongoose camelCase style:

| Collection | Fields | Indexes |
| --- | --- | --- |
| `permissions` | `_id`, `name`, `guardName`, `createdAt`, `updatedAt` | unique `(name, guardName)` |
| `roles` | `_id`, `name`, `guardName`, `teamId`, `createdAt`, `updatedAt` | unique `(name, guardName, teamId)` |
| `role_has_permissions` | `_id`, `roleId`, `permissionId` | unique `(roleId, permissionId)`; `(permissionId)` |
| `model_has_roles` | `_id`, `roleId`, `subjectType`, `subjectId`, `teamId`, optional `expiresAt` | unique `(subjectType, subjectId, teamId, roleId)`; `(roleId, subjectType, teamId)` |
| `model_has_permissions` | `_id`, `permissionId`, `subjectType`, `subjectId`, `teamId`, optional `expiresAt` | unique `(subjectType, subjectId, teamId, permissionId)`; `(permissionId, subjectType, teamId)` |

Links are separate documents rather than arrays embedded in roles or users. Each link is small, has its own unique index, and can be looked up from either side (which subjects hold a role, which roles a subject holds).

### Storage conventions

- **ObjectId ids.** Role and permission ids are MongoDB ObjectIds. The adapter returns them as 24-character hex **strings**, for example `'65f1c0a2e4b0c3a1d2e3f4a5'`. They are not numbers, unlike in the SQL adapters.
- **Subjects.** `subjectType` + `subjectId` hold the [subject](/basic-usage/basic-usage). `subjectId` is a string, so numeric ids, UUIDs and ObjectIds all work. `{ type: 'user', id: 1 }` and `{ type: 'user', id: '1' }` are the same subject.
- **Teams.** `teamId` is a string and `''` means global, as in the SQL adapters. `Role.teamId` comes back as `null` for global roles and as a **string** otherwise (`teamId: 1` is returned as `'1'`). Don't use `''` as a real team id.
- **Timestamps.** `permissions` and `roles` use Mongoose timestamps (`createdAt`, `updatedAt`). The adapter doesn't return them.

## Adapter

<!-- doc-test: skip -->
```ts
mongooseAdapter(options?: { connection?: Connection; prefix?: string; expiry?: boolean }): MongooseRbacAdapter
```

- `connection`: the Mongoose connection to use. Default: the default connection, `mongoose.connection`.
- `prefix`: added to every collection name, for example `'rbac_'` gives `rbac_permissions`, `rbac_roles`, and so on. Default: `''`.
- `expiry`: store an expiry per role assignment and direct permission, for [temporary access](/basic-usage/temporary-access). Default: `false`. See [Expiry (1.2)](#expiry-1-2).

::: code-group

```ts [Default connection]
import mongoose from 'mongoose'
import { createRbac } from '@anievo-id/rbac-evolution'
import { mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'

await mongoose.connect(process.env.MONGO_URL!)

export const rbac = createRbac({ adapter: mongooseAdapter() })
```

```ts [Separate connection]
import mongoose from 'mongoose'
import { createRbac } from '@anievo-id/rbac-evolution'
import { mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'

const conn = mongoose.createConnection(process.env.MONGO_URL!)

export const rbac = createRbac({ adapter: mongooseAdapter({ connection: conn, prefix: 'rbac_' }) })
```

:::

From there it's the normal engine API:

```ts
await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')
await user.can('edit articles') // true
```

### Models

`createRbacModels(options?)` registers the five models on the connection, or reuses them if they are already registered (for example after a hot reload). The model names are `rbac:<collection>`, such as `rbac:roles`, so they never clash with your own `Role` or `Permission` models.

```ts
import { MongooseRbacAdapter, createRbacModels } from '@anievo-id/rbac-evolution-mongoose'

const models = createRbacModels({ prefix: 'rbac_' })
const adapter = new MongooseRbacAdapter(models)

// The models are ordinary Mongoose models:
const globalRoles = await models.Role.find({ teamId: '' }).lean()
```

`rbacSchemas()` returns the schemas before they are registered, in case you want to add plugins or hooks.

### Indexes

The unique indexes enforce name uniqueness and make `attach*` safe when requests race. With Mongoose's `autoIndex` on (the default), the adapter waits for the indexes before its first operation.

If you turn `autoIndex` off in production, create the indexes once, for example in a deploy script:

```ts
import { createRbacModels, syncRbacIndexes } from '@anievo-id/rbac-evolution-mongoose'

await syncRbacIndexes(createRbacModels())
```

### Expiry (1.2)

[Temporary access](/basic-usage/temporary-access) stores when a link ends in the `expiresAt` field of the
`model_has_roles` and `model_has_permissions` documents. **There is nothing to migrate**: from 1.2 the link schemas
declare the optional field (with no default), and a document without it is permanent. Turn it on with the option:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { MongooseRbacAdapter, createRbacModels, mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'

export const rbac = createRbac({ adapter: mongooseAdapter({ expiry: true }) })

// or, with models you registered yourself:
const adapter = new MongooseRbacAdapter(createRbacModels(), { expiry: true })
```

Without the option, the adapter never reads or writes `expiresAt` and an `expiresAt` throws `EXPIRY_NOT_SUPPORTED`.
With it, the models must declare the field (Mongoose drops undeclared fields); `new MongooseRbacAdapter(models,
{ expiry: true })` throws a `TypeError` when they don't, for example with link schemas of your own from before 1.2.

`rbac.pruneExpired()` deletes the expired documents. A MongoDB
[TTL index](https://www.mongodb.com/docs/manual/core/index-ttl/) on `expiresAt` (`expireAfterSeconds: 0`) does the
same in the background, if you prefer; it is not created for you.

### Exports

| Export | Kind |
| --- | --- |
| `mongooseAdapter(options?)`, `MongooseRbacAdapter`, `MongooseAdapterOptions` | function / class / type |
| `createRbacModels(options?)`, `rbacSchemas()`, `syncRbacIndexes(models)`, `collectionNames(options?)` | functions |
| `RbacModels`, `RbacModelOptions`, `RbacCollectionNames` | types |
| `PermissionDoc`, `RoleDoc`, `RoleHasPermissionDoc`, `ModelHasRoleDoc`, `ModelHasPermissionDoc` | types |

## Behaviour notes

- **Invalid ids are ignored.** If the engine passes an id that isn't an ObjectId hex string, the adapter drops it instead of throwing, because no document could match it anyway.
- **Idempotent attach.** Each link is written as an upsert with `$setOnInsert`, matched on its unique key. If two requests insert the same link at the same time, the resulting duplicate-key error is ignored.
- **Link cleanup.** `deleteRole` and `deletePermission` delete the link documents first, then the role or permission.
- **Reverse lookups** ([`subjectsWithRole` / `subjectsWithPermission`](/advanced/querying-subjects)) use `distinct('subjectId')` and return subject ids as strings.

## Mongoose 9

The adapter works the same on Mongoose 8 and 9, and the data is the same: no migration, no index change. Upgrade
Mongoose on its own schedule; the adapter needs no option for it. Mongoose 9 itself brings a few requirements:

- **Node.js 20.19 or later.** Mongoose 9 uses the MongoDB Node.js driver 7, which needs it. Mongoose 8 still runs on
  any Node.js 20.
- **MongoDB server.** The same as with Mongoose 8: 6 or later. CI runs the adapter on MongoDB 7, and it has also
  been tested on 6.0.
- **Hooks you add to the schemas.** If you add middleware to the schemas of `rbacSchemas()`, Mongoose 9 no longer
  passes `next()` to `pre` hooks. Write them as `async` functions:

  ```ts
  import { rbacSchemas } from '@anievo-id/rbac-evolution-mongoose'

  const schemas = rbacSchemas()
  schemas.role.pre('save', async function () {
    // ...
  })
  ```

- **Your own queries on the models.** `create()`, `insertOne()` and query filters are type-checked against the
  document types in Mongoose 9 (`RoleDoc`, `ModelHasRoleDoc`, ...), and `FilterQuery` is renamed `QueryFilter`. The
  adapter itself isn't affected. Nothing changes at runtime.
- **TypeScript.** Mongoose 9's own type declarations need TypeScript 5.3 or later, unless `skipLibCheck` is on
  (it usually is). The adapter's types are the same for Mongoose 8 and 9.

## Transactions

Deletes run a few operations one after another and are **not** wrapped in a transaction, because MongoDB transactions need a replica set. Links are deleted first, so if a delete fails halfway, the role or permission still exists with some of its links removed. Running the same delete again finishes the job.

The adapter doesn't take a session argument. Mongoose 8.4 and later (9 included) can attach the session for you: with `mongoose.set('transactionAsyncLocalStorage', true)`, operations started inside `connection.transaction(async () => { ... })` use that transaction automatically. This setup isn't covered by the adapter's tests. If you use it, run the changes through a short-lived instance with `cache: false`, then call `forgetCachedPermissions()` on your long-lived instance. See [Cache](/advanced/cache).

Full API: [reference](/api/mongoose/)

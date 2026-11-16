# @anievo-id/rbac-evolution-mongoose

[Mongoose](https://mongoosejs.com) (MongoDB) storage adapter for
[RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution).

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-mongoose mongoose
```

Requires `mongoose` 8 or later.

## Usage

```ts
import mongoose from 'mongoose'
import { createRbac } from '@anievo-id/rbac-evolution'
import { mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'

await mongoose.connect(process.env.MONGO_URL!)

export const rbac = createRbac({
  adapter: mongooseAdapter(), // options: { connection, prefix: 'rbac_' }
})

await rbac.for({ type: 'user', id: currentUser.id }).can('edit articles')
```

- Role and permission ids are ObjectIds, returned as 24-character hex strings.
- The models are registered as `rbac:<collection>` (for example `rbac:roles`), so they don't clash with your own.
- The unique indexes make `attach*` safe under concurrency. If you turn Mongoose's `autoIndex` off in production,
  run `await syncRbacIndexes(createRbacModels())` once at deploy time.
- Deletes don't use a transaction, so no replica set is needed.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/mongoose

## License

MIT

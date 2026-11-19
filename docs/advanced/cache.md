# Cache

A permission check needs several adapter queries: the subject's roles, its direct permissions, and the permissions of those roles. To avoid running them on every `can()`, the engine caches each subject's **resolved state** and clears the cache whenever something changes.

## Defaults

With no extra options, you get an in-process `MemoryCache` with a 24-hour TTL:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter }) // cache: new MemoryCache(), cacheTtl: 24h
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cache` | `CacheStore \| false` | `new MemoryCache()` | Where the resolved state is stored. `false` turns caching off. |
| `cacheTtl` | `number` (ms) | `86_400_000` (24 h) | How long each entry lives. Passed to `CacheStore.set()`. |

### What is cached

There is one entry per **subject + guard + team**. It holds that subject's roles, direct permissions, and permissions inherited from its roles. Every read on `rbac.for(subject)` goes through it: `hasRole`, `can`, `hasPermissionTo`, `getRoleNames`, `getAllPermissions`, `snapshot()`, and the rest.

There is also one entry per **guard** with the names of all its permissions. `can()` and `hasPermissionTo()` use it to check that a permission exists (when `wildcard` is off), so repeated checks don't query the database.

[`teams()`](/basic-usage/teams#listing-a-subject-s-teams) has one entry per **subject + guard** (or subject alone with `allGuards`), with the list of team ids.

Other calls are **not** cached and always reach the adapter:

- `findPermission`, `findRole`, `getRoles`, `getPermissions`, `rbac.role(...).getPermissions()`.
- Resolving names to rows when you assign or revoke.
- [`subjectsWithRole` / `subjectsWithPermission`](/advanced/querying-subjects).

### When the cache is cleared

The cache is cleared as a whole after **every** change made through the engine: creating or deleting roles and permissions, assigning, removing or syncing roles, giving, revoking or syncing permissions, `revokeAll()` and `deleteTeam()`. It happens right after the adapter write and before any [event listeners](/advanced/events) run.

Changes are rare compared to checks, so clearing everything is simple and safe: no entry can stay stale after a change. It matters for `deleteTeam()`: it changes the access of every member of the team, and clearing the whole cache drops all of their entries at once, not only the caller's.

### Expiry

With [temporary access](/basic-usage/temporary-access), a cached state must not outlive the role or permission
that expires first inside it. The engine takes care of it in two ways:

- **The TTL is capped.** An entry is stored for `cacheTtl` or until the earliest `expiresAt` in it, whichever is
  sooner. A state with a role that ends in 10 minutes is stored for 10 minutes, not 24 hours. The same goes for
  `teams()` entries. States without an expiry keep the full `cacheTtl`, and look exactly as in 1.1.
- **The state carries its end.** An entry with an expiry also holds `validUntil` (epoch milliseconds). On a hit at or
  after that moment, by the engine's clock, the engine ignores the entry and recomputes it. So a store that keeps it
  a little longer (Redis `EX` rounds up to whole seconds, a store that ignores the TTL, clocks that differ between
  servers) never serves an expired role.

Nothing is cleared when a link expires: there is no change to react to, only time passing. `pruneExpired()` doesn't
clear the cache either, because removing expired rows doesn't change any check.

A [custom store](#custom-store) needs no change for this: it receives the shorter TTL in `set()`, and the extra
field is plain JSON.

## Changing the TTL

```ts
const rbac = createRbac({ adapter, cacheTtl: 5 * 60_000 }) // 5 minutes
```

The TTL limits how long stale data can survive when the cache is **not** cleared for you, for example when another process changes the database. See [Multiple processes](#multiple-processes).

::: info MemoryCache housekeeping
`MemoryCache` deletes an expired entry when it is next read, and keeps at most `maxEntries` entries (default
10 000): when it is full, the oldest write is dropped. A dropped entry is simply recomputed on the next check.
Raise the limit if you check many more distinct users per TTL than that:

```ts
import { createRbac, MemoryCache } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter, cache: new MemoryCache({ maxEntries: 50_000 }) })
```
:::

## Turning the cache off

```ts
const rbac = createRbac({ adapter, cache: false })
```

Every check then reads from the adapter. This is useful in tests, inside short-lived [transaction instances](/adapters/drizzle#transactions), and in multi-process setups that have no shared cache.

## Clearing the cache manually

```ts
await rbac.forgetCachedPermissions()
```

Call it when the data changed **without** going through this `rbac` instance:

- you edited the tables with raw SQL, a migration, or a database admin tool,
- a seed script or another service wrote to the same database,
- you used a second `createRbac` instance (for example one bound to a transaction).

## Custom store

For Redis and Valkey, use the [Redis package](#redis-and-valkey). To keep the cache in Memcached, a KV store or anything else, implement `CacheStore`:

```ts
interface CacheStore {
  get(key: string): unknown | Promise<unknown>
  set(key: string, value: unknown, ttlMs: number): void | Promise<void>
  clear(): void | Promise<void>
}
```

Methods may be synchronous or return promises. The contract:

- **`get`** returns the stored value, or **`undefined`** on a miss. Return `undefined`, not `null`: any value other than `undefined` counts as a hit.
- **`set`** stores the value for `ttlMs` milliseconds. The value is a plain object made of arrays of `Role` and `Permission` objects (plus, with [expiry](#expiry), numbers), so `JSON.stringify` / `JSON.parse` round-trip it. `ttlMs` can be shorter than `cacheTtl` when an assignment in the value expires sooner.
- **`clear`** removes **every** RBAC Evolution entry. It is called after every change, so the store should be dedicated to RBAC Evolution or namespaced by your implementation. Don't flush a shared database.

### Redis and Valkey

`@anievo-id/rbac-evolution-redis` is a ready `CacheStore` for Redis and Valkey. Every process that uses the same server and
prefix shares one cache, and a change made in any of them is seen by all the others on their next check.

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution-redis
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution-redis
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution-redis
```

:::

Pass it a connected client of [ioredis](https://github.com/redis/ioredis) or
[node-redis](https://github.com/redis/node-redis) 4+ (or iovalkey, `@valkey/client`):

```ts
import { Redis } from 'ioredis'
import { createRbac } from '@anievo-id/rbac-evolution'
import { RedisCache } from '@anievo-id/rbac-evolution-redis'

const redis = new Redis(process.env.REDIS_URL!)

export const rbac = createRbac({
  adapter,
  cache: new RedisCache({ client: redis }),
  cacheTtl: 60 * 60_000, // 1 hour
})
```

```ts
import { createClient } from 'redis'
import { createRbac } from '@anievo-id/rbac-evolution'
import { RedisCache } from '@anievo-id/rbac-evolution-redis'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

export const rbac = createRbac({ adapter, cache: new RedisCache({ client: redis }) })
```

| Option | Type | Description |
| --- | --- | --- |
| `client` | ioredis or node-redis client | Anything with ioredis's `call()` or node-redis's `sendCommand()`. The package imports neither. |
| `prefix` | `string` | Prepended to every key. Default: `'rbac-cache:'`. Use one prefix per app on a shared server. |

How it stores entries:

- **Keys** are `<prefix><generation>:<key>`, with the value as JSON and a `PX` TTL in milliseconds.
- **`clear()`** is one `INCR` of `<prefix>generation`. Entries of an older generation are never read again and
  expire through their TTL. Nothing is scanned or deleted, so it costs the same with a million cached subjects, and
  works on a cluster.
- **A lookup that overlaps a change** in another process is written under the generation it started in, so a value
  computed from data read before the change is never served after it.
- A check reads two keys (the generation, then the entry): two round trips on a cache hit.

A client with neither method, such as a REST client, needs a [custom store](#custom-store). Make its `get` return
`undefined` on a miss, and the value already parsed.

## Multiple processes

`MemoryCache` lives inside one process. When you run several instances (a cluster, several containers, serverless functions), a change made in process A clears **only A's** cache. Process B keeps serving its cached state until the TTL expires.

Choose one of these:

| Approach | Trade-off |
| --- | --- |
| **Shared store** ([Redis](#redis-and-valkey)) | Every process sees the same entries, and `clear()` affects all of them. Recommended for production clusters. |
| **Short `cacheTtl`** (for example 30–60 s) | Simple, no extra infrastructure. Changes may take up to the TTL to show up in other processes. |
| **`cache: false`** | Always correct. Costs a few adapter queries per check. |
| **Broadcast a clear** | Publish a message after each change (for example from an [event listener](/advanced/events)) and call `rbac.forgetCachedPermissions()` in every process that receives it. |

::: warning Revoking access
Leftover cached data in other processes can let a user keep a permission you just revoked until the TTL runs out. For sensitive permissions in a multi-process deployment, use a shared store or a short TTL.
:::

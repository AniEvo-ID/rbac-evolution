# @anievo-id/rbac-evolution-redis

A Redis and Valkey cache store for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): one cache shared by
every process, so a role removed on one server is denied on all of them on the next check.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-redis
```

## Usage

```ts
import { Redis } from 'ioredis'
import { createRbac } from '@anievo-id/rbac-evolution'
import { RedisCache } from '@anievo-id/rbac-evolution-redis'

export const rbac = createRbac({
  adapter,
  cache: new RedisCache({ client: new Redis(process.env.REDIS_URL!) }),
})
```

- Takes an [ioredis](https://github.com/redis/ioredis) or [node-redis](https://github.com/redis/node-redis) client
  (or iovalkey, `@valkey/client`). No runtime import of either.
- `clear()` is one `INCR` of a generation counter: no `SCAN`, no `DEL`, works on a cluster.
- A lookup that overlaps a change in another process is never served after that change.
- `prefix` (default `'rbac-cache:'`) namespaces every key.

## Documentation

https://creation.anievo.id/rbac-evolution/advanced/cache#redis-and-valkey

## License

MIT

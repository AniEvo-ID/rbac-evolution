# @anievo-id/rbac-evolution-redis

## 1.6.0

### Patch Changes

- @anievo-id/rbac-evolution@1.6.0

## 1.5.0

### Minor Changes

- 679d05a: New package `@anievo-id/rbac-evolution-redis`: `new RedisCache({ client, prefix? })` is a `CacheStore` for Redis and Valkey that every process shares, so a change made in one process is seen by all of them on their next check. It takes an ioredis or node-redis client (anything with `call()` or `sendCommand()`) and imports neither. Entries are JSON with a `PX` TTL; `clear()` is one `INCR` of a generation counter, so nothing is scanned or deleted and it works on a cluster. A lookup that overlaps a change in another process is written under the generation it started in, so a value read before the change is never served after it.

### Patch Changes

- Updated dependencies [72e73a6]
  - @anievo-id/rbac-evolution@1.5.0

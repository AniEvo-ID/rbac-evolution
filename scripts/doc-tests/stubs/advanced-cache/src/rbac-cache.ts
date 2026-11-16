// `rbac-cache.ts`, the Redis store of the block before.
import type { CacheStore } from '@anievo-id/rbac-evolution'
import type { Redis } from 'ioredis'

export declare class RedisCache implements CacheStore {
  constructor(redis: Redis, prefix?: string)
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, ttlMs: number): Promise<void>
  clear(): Promise<void>
}

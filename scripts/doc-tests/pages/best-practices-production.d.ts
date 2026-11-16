declare const adapter: RbacAdapter
/** The Redis store of the Cache page ("Redis example"). */
declare class RedisCache implements CacheStore {
  constructor(redis: import('ioredis').Redis, prefix?: string)
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, ttlMs: number): Promise<void>
  clear(): Promise<void>
}
declare const redis: import('ioredis').Redis

import type { CacheStore } from '@anievo-id/rbac-evolution'

/** A client that runs raw commands the ioredis way: `call('GET', key)` (ioredis, iovalkey). */
export interface IoRedisLikeClient {
  call(command: string, ...args: string[]): Promise<unknown>
}

/** A client that runs raw commands the node-redis way: `sendCommand(['GET', key])` (redis 4+, @valkey/client). */
export interface NodeRedisLikeClient {
  sendCommand(args: string[]): Promise<unknown>
}

const PENDING_MS = 60_000

export type RedisCacheClient = IoRedisLikeClient | NodeRedisLikeClient

export interface RedisCacheOptions {
  /** A connected ioredis or node-redis client (or one with the same `call` / `sendCommand`). */
  client: RedisCacheClient
  /**
   * Prepended to every key. Use one prefix per app that shares the server. Default: `'rbac-cache:'`.
   */
  prefix?: string | undefined
}

/**
 * A {@link CacheStore} in Redis or Valkey, shared by every process that uses the same server and prefix.
 *
 * `clear()` bumps a generation counter instead of deleting keys: entries of an older generation are no
 * longer read, and expire on their own TTL. It is one `INCR`, on a cluster too.
 */
export class RedisCache implements CacheStore {
  readonly #run: (args: string[]) => Promise<unknown>
  readonly #prefix: string
  readonly #generationKey: string
  // Per key, the oldest generation a pending lookup started in, and how many are pending. A value computed
  // before another process's clear() is written under that old generation, so nobody reads it.
  // shortcut: a lookup that throws never calls set(), so an entry older than PENDING_MS is dropped; a real
  // lookup never takes that long.
  readonly #pending = new Map<string, { generation: number; count: number; since: number }>()

  constructor(options: RedisCacheOptions) {
    const { client } = options
    if (typeof (client as IoRedisLikeClient).call === 'function') {
      const io = client as IoRedisLikeClient
      this.#run = ([command, ...args]) => io.call(command!, ...args)
    } else if (typeof (client as NodeRedisLikeClient).sendCommand === 'function') {
      const node = client as NodeRedisLikeClient
      this.#run = (args) => node.sendCommand(args)
    } else {
      throw new TypeError('RedisCache: `client` needs a `call()` (ioredis) or `sendCommand()` (node-redis) method.')
    }
    this.#prefix = options.prefix ?? 'rbac-cache:'
    this.#generationKey = `${this.#prefix}generation`
  }

  async get(key: string): Promise<unknown> {
    const generation = await this.#generation()
    const raw = await this.#run(['GET', this.#key(generation, key)])
    if (raw !== null && raw !== undefined) return JSON.parse(String(raw))
    // A miss: the engine computes the value and calls set() next.
    const pending = this.#live(key)
    if (pending) {
      pending.generation = Math.min(pending.generation, generation)
      pending.count++
    } else {
      this.#pending.set(key, { generation, count: 1, since: Date.now() })
    }
    return undefined // never null: the engine counts anything else as a hit
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    const pending = this.#live(key)
    if (pending && --pending.count === 0) this.#pending.delete(key)
    const generation = pending?.generation ?? (await this.#generation())
    const ms = String(Math.max(1, Math.ceil(ttlMs)))
    await this.#run(['SET', this.#key(generation, key), JSON.stringify(value), 'PX', ms])
  }

  async clear(): Promise<void> {
    await this.#run(['INCR', this.#generationKey])
  }

  #live(key: string): { generation: number; count: number; since: number } | undefined {
    const pending = this.#pending.get(key)
    if (pending && Date.now() - pending.since > PENDING_MS) {
      this.#pending.delete(key)
      return undefined
    }
    return pending
  }

  async #generation(): Promise<number> {
    return Number((await this.#run(['GET', this.#generationKey])) ?? 0)
  }

  #key(generation: number, key: string): string {
    return `${this.#prefix}${generation}:${key}`
  }
}

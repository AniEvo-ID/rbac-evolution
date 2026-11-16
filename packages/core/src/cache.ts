/**
 * Cache used to store each subject's resolved roles & permissions.
 * Can be sync (in-memory) or async (Redis, KV, ...).
 *
 * `clear()` is called whenever roles or permissions change, so the store
 * should be dedicated to RBAC Evolution (or namespaced by your implementation).
 */
export interface CacheStore {
  get(key: string): unknown | Promise<unknown>
  set(key: string, value: unknown, ttlMs: number): void | Promise<void>
  clear(): void | Promise<void>
}

export interface MemoryCacheOptions {
  /**
   * Most entries kept at once (one per subject, guard and team, plus one per guard's permission names).
   * When full, the oldest entry is dropped. Default: 10 000.
   */
  maxEntries?: number | undefined
}

/** Default in-process cache with TTL support and a size limit. */
export class MemoryCache implements CacheStore {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>()
  private readonly maxEntries: number

  constructor(options: MemoryCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 10_000)
  }

  get(key: string): unknown {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: unknown, ttlMs: number): void {
    // Re-inserting moves the key to the end, so the first key in the Map is always the oldest write.
    this.store.delete(key)
    if (this.store.size >= this.maxEntries) this.store.delete(this.store.keys().next().value!)
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  /** Number of entries currently held (expired ones are dropped lazily). */
  get size(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }
}

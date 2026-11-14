/**
 * Cache used to store each subject's resolved roles & permissions.
 * Can be sync (in-memory) or async (Redis, KV, ...).
 *
 * `clear()` is called whenever roles or permissions change, so the store
 * should be dedicated to rbac-evolution (or namespaced by your implementation).
 */
export interface CacheStore {
  get(key: string): unknown | Promise<unknown>
  set(key: string, value: unknown, ttlMs: number): void | Promise<void>
  clear(): void | Promise<void>
}

/** Default in-process cache with TTL support. */
export class MemoryCache implements CacheStore {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>()

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
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  clear(): void {
    this.store.clear()
  }
}

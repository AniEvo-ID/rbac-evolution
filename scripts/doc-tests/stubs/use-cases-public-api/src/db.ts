// `./db`: the API product's own data layer (any ORM) and the rbac adapter built on it.
import { MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'

export interface ApiKey {
  id: string
  name: string
  accountId: number
  revokedAt: Date | null
}

export declare const db: {
  apiKeys: {
    /** Stores a hash of a new random secret; returns the secret once. */
    create(data: { name: string; accountId: number }): Promise<{ key: ApiKey; secret: string }>
    find(id: string): Promise<ApiKey | null>
    findActiveBySecret(secret: string): Promise<ApiKey | null>
    update(id: string, data: Partial<Omit<ApiKey, 'id'>>): Promise<ApiKey>
  }
}

export const adapter: RbacAdapter = new MemoryAdapter()

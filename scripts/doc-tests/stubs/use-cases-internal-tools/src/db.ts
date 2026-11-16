// `./db`: the panel's own database module: the rbac adapter and the table of temporary grants.
import { MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'
import type { GrantStore } from './access-grants'

export const adapter: RbacAdapter = new MemoryAdapter()

export declare const grants: GrantStore

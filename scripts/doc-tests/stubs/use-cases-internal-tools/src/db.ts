// `./db`: the panel's own database module: the rbac adapter, with expiry for temporary access.
import { MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'

export const adapter: RbacAdapter = new MemoryAdapter({ expiry: true })

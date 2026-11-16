// `./db`: the shop's own database module, with the rbac adapter built on it.
import { MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'

export const adapter: RbacAdapter = new MemoryAdapter()

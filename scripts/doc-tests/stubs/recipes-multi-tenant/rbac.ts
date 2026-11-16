// `rbac.ts` of step 1 (the seed script imports it as `../rbac`).
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })

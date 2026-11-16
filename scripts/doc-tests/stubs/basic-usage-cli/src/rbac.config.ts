// `rbac.config.ts` of the CLI page.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'

export default defineConfig({ rbac: createRbac({ adapter: new MemoryAdapter() }) })

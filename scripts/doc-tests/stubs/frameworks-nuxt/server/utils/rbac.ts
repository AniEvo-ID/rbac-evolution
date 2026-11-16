// `server/utils/rbac.ts` ("Resolve the subject on the server"), auto-imported in server files.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-nuxt/server'
import type { H3Event } from 'h3'

export const rbac = createRbac({ adapter: new MemoryAdapter() })

export const rbacServer = createRbacServer<H3Event>({ rbac, getSubject: () => null })

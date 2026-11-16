// `audit-context.ts` (the first block).
import { AsyncLocalStorage } from 'node:async_hooks'
import type { RbacActor } from '@anievo-id/rbac-evolution'

export const auditContext = new AsyncLocalStorage<RbacActor>()

// `audit-context.ts` (the first block).
import { AsyncLocalStorage } from 'node:async_hooks'

export const auditContext = new AsyncLocalStorage<{ actorId: string }>()

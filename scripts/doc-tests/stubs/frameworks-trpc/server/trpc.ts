// `@/server/trpc`, as the tRPC guide's "Setup" creates it.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createRbacContext, rbacErrorFormatter, requirePermission } from '@anievo-id/rbac-evolution-trpc'
import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

export type User = { id: string }
declare function getUser(req: Request): Promise<User | null>

export const rbac = createRbac({ adapter: new MemoryAdapter() })

export const rbacContext = createRbacContext({
  rbac,
  getSubject: (user: User | null) => (user ? { type: 'user', id: user.id } : null),
})

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const user = await getUser(req)
  return { user, ...(await rbacContext(user)) }
}
export type Context = Awaited<ReturnType<typeof createContext>>

export const t = initTRPC.context<Context>().create({ errorFormatter: rbacErrorFormatter })

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure
export const editorProcedure = t.procedure.use(requirePermission('articles.edit'))

// `@/server/routers/_app`: the tRPC guide's app router.
import { requireRole } from '@anievo-id/rbac-evolution-trpc'
import { editorProcedure, publicProcedure, router } from '@/server/trpc'

export const appRouter = router({
  articles: router({
    list: publicProcedure.query(() => [] as { id: string; title: string }[]),
    update: editorProcedure
      .input({ parse: (value: unknown) => value as { id: string; title: string } })
      .mutation(({ input }) => input),
  }),
  admin: router({
    stats: publicProcedure.use(requireRole('admin')).query(() => ({ users: 0 })),
  }),
})

export type AppRouter = typeof appRouter

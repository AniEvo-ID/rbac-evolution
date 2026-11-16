# @anievo-id/rbac-evolution-trpc

[tRPC](https://trpc.io) middleware for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): permission and
role guards for procedures, with a typed, non-null `ctx.rbac` after them.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-trpc @trpc/server
```

## Usage

```ts
import { initTRPC } from '@trpc/server'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createGuards, createRbacContext, rbacErrorFormatter } from '@anievo-id/rbac-evolution-trpc'

const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
const rbacContext = createRbacContext({
  rbac,
  getSubject: (user: User | null) => (user ? { type: 'user', id: user.id } : null),
})

export async function createContext({ req }: { req: Request }) {
  const user = await getUser(req) // yours
  return { user, ...(await rbacContext(user)) } // ctx.rbac: SubjectRbac | null
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create({ errorFormatter: rbacErrorFormatter })
const { requirePermission, requireRole } = createGuards<typeof rbac>()

export const appRouter = t.router({
  publish: t.procedure.use(requirePermission('posts.publish')).mutation(async ({ ctx }) => {
    await ctx.rbac.can('posts.delete') // ctx.rbac is never null here, and the names are typed
  }),
  stats: t.procedure.use(requireRole('admin|editor')).query(() => getStats()),
})
```

- Guests get a `TRPCError` `UNAUTHORIZED`, users without access a `TRPCError` `FORBIDDEN`. With
  `rbacErrorFormatter`, clients read `{ error, reason, message }` from `error.data.rbac`. The required names are
  only added with `exposeRequirements: true`. Leave it off in production.
- `createGuards<AppRbac>()` checks names at compile time; `createGuards<AppRbac, 'api'>()` with names per guard.
- `createGuards({ resolve: ({ ctx }) => ... })` reads the subject from the call instead of `ctx.rbac`.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/trpc

## License

MIT

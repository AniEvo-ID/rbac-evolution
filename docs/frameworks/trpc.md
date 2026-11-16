# tRPC

`@anievo-id/rbac-evolution-trpc` adds RBAC Evolution to [tRPC](https://trpc.io) v11 routers: a helper that puts the
current user's access in the context, and procedure middleware — `requirePermission`, `requireRole` and
`requireRoleOrPermission` — that mirror spatie/laravel-permission's `permission`, `role` and `role_or_permission`
middleware.

```ts
t.procedure.use(requirePermission('articles.edit')).mutation(async ({ ctx }) => {
  await ctx.rbac.can('articles.publish') // ctx.rbac is never null after the guard
})
```

The guards take the same arguments as the [Express](/frameworks/express) and [Hono](/frameworks/hono) ones, and a
denied call carries the same `error`, `reason` and `message` fields, as a `TRPCError`.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-trpc
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-trpc
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-trpc
```

:::

`@trpc/server` (11 or newer) is a peer dependency.

::: info Why not tRPC 10?
tRPC 11 is the current major (since March 2025); 10 only gets security fixes. The two have different middleware
and context types, and the typing this package is about (`ctx.rbac` narrowed after a guard) is built on 11's. If you
are still on 10, the [upgrade guide](https://trpc.io/docs/migrate-from-v10-to-v11) is short for server code.
:::

## Setup

Authentication is up to you (a session cookie, a JWT, Auth.js, …). Resolve the user in `createContext`, then add
`ctx.rbac` with `createRbacContext()`:

```ts
// server/trpc.ts
import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createRbacContext, rbacErrorFormatter, requirePermission } from '@anievo-id/rbac-evolution-trpc'

export const rbac = createRbac({ adapter: new MemoryAdapter() })

export const rbacContext = createRbacContext({
  rbac,
  // Gets what you pass it. Return null or undefined for guests.
  getSubject: (user: User | null) => (user ? { type: 'user', id: user.id } : null),
})

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const user = await getUser(req) // your auth
  return { user, ...(await rbacContext(user)) }
}
export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({ errorFormatter: rbacErrorFormatter })

export const router = t.router
export const publicProcedure = t.procedure
export const editorProcedure = t.procedure.use(requirePermission('articles.edit'))
```

Then use the guards on any procedure, or build reusable procedures from them like `editorProcedure` above:

```ts
// server/routers/_app.ts
import { z } from 'zod'
import { requireRole } from '@anievo-id/rbac-evolution-trpc'
import { editorProcedure, publicProcedure, router } from '@/server/trpc'

export const appRouter = router({
  articles: router({
    list: publicProcedure.query(() => db.articles.list()),
    update: editorProcedure
      .input(z.object({ id: z.string(), title: z.string() }))
      .mutation(({ input }) => db.articles.update(input.id, { title: input.title })),
  }),
  admin: router({
    stats: publicProcedure.use(requireRole('admin')).query(() => db.stats()),
  }),
})

export type AppRouter = typeof appRouter
```

`rbacErrorFormatter` is optional: it sends the reason of a denial to the client, see [Errors](#errors).

### `createRbacContext` options

| Option       | Type                                                    | Description                                                |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------- |
| `rbac`       | `Rbac`                                                  | Your `createRbac(...)` instance. **Required.**             |
| `getSubject` | `(input) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                |
| `guard`      | `string`                                                | Guard name. Defaults to the engine's `defaultGuard`.       |
| `team`       | `(input) => TeamId \| undefined \| Promise<…>`          | Current team. Only for engines created with `teams: true`. |

`input` is whatever you pass to the function it returns: the user, the request, the `createContext` options. Its type
comes from the parameter of `getSubject`.

## `ctx.rbac`

`ctx.rbac` is:

- a `SubjectRbac` for the current subject (the same object `rbac.for(subject, { guard, team })` returns), or
- `null` for guests.

**After a guard, it is never `null`**: the middleware passes the subject on, so TypeScript narrows `ctx.rbac` to
`SubjectRbac` in the next middleware and in the resolver. Use it for checks inside procedures and to send a snapshot
to the browser:

```ts
const appRouter = router({
  // Feed the React / Vue packages
  myPermissions: publicProcedure.query(async ({ ctx }) => (ctx.rbac ? await ctx.rbac.snapshot() : null)),

  publish: t.procedure.use(requireRole('editor')).mutation(async ({ ctx }) => {
    const canDelete = await ctx.rbac.can('articles.delete') // no `?.`: the guard ran
    return { canDelete }
  }),
})
```

A procedure whose context has no `rbac` can't use a guard: `.use(requirePermission(...))` is a type error there. Add
`ctx.rbac` in `createContext` or in an earlier middleware, or give the guards a [`resolve`](#resolving-the-subject-in-the-guards).

## Guards

Guards are tRPC middleware, so they go in `.use()`, in any order with your own middleware, and on as many
procedures as you like:

```ts
const adminProcedure = t.procedure.use(requireRole('admin'))

const adminRouter = router({
  stats: adminProcedure.query(() => db.stats()),
  users: adminProcedure.use(requirePermission('users.manage')).query(() => []),
})
```

### `requirePermission`

```ts
t.procedure.use(requirePermission('articles.edit'))

// any of them — pipe syntax, like spatie's permission:a|b
t.procedure.use(requirePermission('articles.edit|articles.delete'))

// all of them — one argument per requirement
t.procedure.use(requirePermission('articles.edit', 'articles.publish'))

// any of them — with { any: true }
t.procedure.use(requirePermission('articles.edit', 'articles.publish', { any: true }))
```

Permission checks use `can()`, so the engine's `before` hook and `superAdminRoles` apply. Unknown permissions simply
fail the check; they never throw.

### `canAny` / `canAll`

Named forms of the two common cases, like spatie v8.5's route macros. `canAny` passes with **any** of the
permissions. `canAll` needs **every** argument; a pipe inside one argument still means "any of these".

```ts
t.procedure.use(canAny('articles.edit', 'articles.publish'))
t.procedure.use(canAll('articles.edit', 'articles.publish|articles.delete'))
```

### `requireRole`

```ts
t.procedure.use(requireRole('admin'))
t.procedure.use(requireRole('admin|editor')) // any of
t.procedure.use(requireRole('admin', 'editor')) // any of
t.procedure.use(requireRole('writer', 'editor', { all: true })) // all of
```

### `requireRoleOrPermission`

Passes when the user has **any** of the names, either as a role or as a permission:

```ts
t.procedure.use(requireRoleOrPermission('admin|dashboard.view'))
```

### Combining names

| Guard                     | `'a\|b'` | `'a', 'b'` (separate args) | Option                              |
| ------------------------- | -------- | -------------------------- | ----------------------------------- |
| `requirePermission`       | any      | **all**                    | `{ any: true }` → any of everything |
| `requireRole`             | any      | any                        | `{ all: true }` → all of everything |
| `requireRoleOrPermission` | any      | any                        | —                                   |

Arrays are accepted wherever a name is; each array item counts like a separate argument, so
`requirePermission(['a', 'b'])` requires both. Guards created with no names throw a `TypeError` at startup.

## Checks that depend on the input

A guard runs before your resolver and does not read the input. For checks that do, such as "writers may only edit
their own articles", check inside the procedure: after a guard, `ctx.rbac` is there and non-null.

```ts
import { z } from 'zod'

const articlesRouter = router({
  update: t.procedure
    .use(requirePermission('articles.edit'))
    .input(z.object({ id: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const article = await db.articles.find(input.id)
      // Editors may change any article, writers only their own.
      if (article.authorId !== ctx.user?.id && !(await ctx.rbac.hasRole('editor'))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your article.' })
      }
      return db.articles.update(input.id, { title: input.title })
    }),
})
```

## Errors

A guard throws a `TRPCError`, so tRPC answers with its usual error, and the right HTTP status over HTTP:

| Situation                       | Error                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Guest (`ctx.rbac === null`)     | `TRPCError` `UNAUTHORIZED` (HTTP 401), message `User is not logged in.`                                    |
| Missing role/permission         | `TRPCError` `FORBIDDEN` (HTTP 403), message `User does not have the right permissions.` (or `roles`, …)    |
| `ctx.rbac` not set              | `RbacContextMissingError` (`code: 'RBAC_CONTEXT_MISSING'`), which tRPC reports as `INTERNAL_SERVER_ERROR` |

The error's `cause` is an `RbacAccessError` whose `body` is the 401 / 403 body of the other integrations:

```ts
type RbacErrorBody =
  | { error: 'UNAUTHENTICATED'; message: string }
  | { error: 'FORBIDDEN'; reason: 'permission' | 'role' | 'role_or_permission'; message: string; required?: string[][] }
```

tRPC doesn't send the cause to clients. `rbacErrorFormatter` does: it adds the body to the error shape as
`data.rbac` (`null` for other errors), and the client's types know it:

```ts
// a client component, a script, ...
import { createTRPCClient, httpBatchLink, isTRPCClientError } from '@trpc/client'
import type { AppRouter } from '@/server/routers/_app'

const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: '/api/trpc' })] })

try {
  await trpc.articles.update.mutate({ id: '1', title: 'Hello' })
} catch (error) {
  if (isTRPCClientError<AppRouter>(error) && error.data?.rbac?.error === 'FORBIDDEN') {
    console.log(error.data.rbac.reason) // 'permission'
  }
}
```

With your own formatter, call it first and extend what it returns, or use `getRbacErrorBody(error)`, which also
works in `onError` for logging:

```ts
import { initTRPC } from '@trpc/server'
import { rbacErrorFormatter } from '@anievo-id/rbac-evolution-trpc'

const t = initTRPC.context<Context>().create({
  errorFormatter: (opts) => {
    const shape = rbacErrorFormatter(opts)
    return { ...shape, data: { ...shape.data, path: opts.path ?? null } }
  },
})
```

The body describes the kind of check but **not** the names that were required. To include them (for example
during development), pass `exposeRequirements: true`; the body then gets a `required` field with the groups of names.

::: warning
Exposing the required permissions tells callers exactly what to look for. Keep `exposeRequirements` off in
production. See [Security](/best-practices/security).
:::

## Custom handlers

Every guard accepts `onUnauthenticated` and `onForbidden` in its options object. Both receive
`({ ctx, path, type, rbac }, context)`, where `context` is `{ kind, requirements }`, and return the error to throw —
or throw it themselves. Return a `TRPCError`: anything else reaches the client as an `INTERNAL_SERVER_ERROR`.

```ts
t.procedure.use(
  requirePermission('articles.delete', {
    // Hide the procedure from users who can't use it.
    onForbidden: () => new TRPCError({ code: 'NOT_FOUND' }),
    onUnauthenticated: ({ path }) => new TRPCError({ code: 'UNAUTHORIZED', message: `Log in to call ${path}.` }),
  }),
)
```

### `createGuards`

To change the defaults for every guard, build your own set with `createGuards()`:

```ts
// server/rbac-guards.ts
import { TRPCError } from '@trpc/server'
import { createGuards } from '@anievo-id/rbac-evolution-trpc'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onForbidden: ({ path }, { kind }) => new TRPCError({ code: 'FORBIDDEN', message: `${path}: missing ${kind}` }),
})
```

Options passed to an individual guard still override the shared defaults. `createGuards()` accepts
`onUnauthenticated`, `onForbidden`, `exposeRequirements` and `resolve`.

### Resolving the subject in the guards

By default the guards read `ctx.rbac`. To resolve the subject from something else in the context, give
`createGuards()` a `resolve`. Its procedures then don't need `rbac` in their context, and still get a non-null
`ctx.rbac` after the guard:

```ts
import { initTRPC } from '@trpc/server'
import { createGuards } from '@anievo-id/rbac-evolution-trpc'

const { requirePermission } = createGuards({
  resolve: ({ ctx }: { ctx: { user: User | null } }) => (ctx.user ? rbac.for({ type: 'user', id: ctx.user.id }) : null),
})

const plain = initTRPC.context<{ user: User | null }>().create()

const appRouter = plain.router({
  publish: plain.procedure.use(requirePermission('articles.publish')).mutation(async ({ ctx }) => {
    await ctx.rbac.can('articles.delete')
  }),
})
```

`resolve` runs once per guard and call (`rbac.for()` is cheap, and the engine caches the checks). Prefer
`createRbacContext()` when every procedure needs the subject anyway.

## Typed names

If you pass a type to `createRbac<AppRbac>()`, pass the same type to `createGuards()`. Then a typo in a guard is a
compile error. Every name is checked, including each part of a `'a|b'` list and each array item.

```ts
import { createGuards } from '@anievo-id/rbac-evolution-trpc'
import type { AppRbac } from './rbac' // the type you pass to createRbac<AppRbac>()

export const { requirePermission, requireRole } = createGuards<AppRbac>()

t.procedure.use(requirePermission('edit articles|publish articles'))
t.procedure.use(requirePermission('delete artcles')) // type error
```

`createGuards<typeof rbac>()` works too. After a typed guard, `ctx.rbac` checks names like the engine does, and so
does the subject `onForbidden` gets:

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createGuards, createRbacContext, type RbacContext } from '@anievo-id/rbac-evolution-trpc'
import { initTRPC } from '@trpc/server'
import type { AppRbac } from './rbac'

const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
const rbacContext = createRbacContext({ rbac, getSubject: (user: User | null) => user && { type: 'user', id: user.id } })
const { requirePermission } = createGuards<typeof rbac>()

type Context = RbacContext<typeof rbac> & { user: User | null } // or Awaited<ReturnType<typeof createContext>>
const t = initTRPC.context<Context>().create()

const publish = t.procedure.use(requirePermission('edit articles')).mutation(async ({ ctx }) => {
  if (!(await ctx.rbac.can('publish articles'))) throw new Error('nope')
  await ctx.rbac.can('publish artcles') // type error
})
```

A guard without names, or with options before a name, is a type error too. The guards exported by the package still
accept any string, and leave an untyped `ctx.rbac` after them. See [Typed names](/basic-usage/typed-names).

## Teams

When the engine is created with `teams: true`, resolve the current team in `createRbacContext()`:

```ts
const rbac = createRbac({ adapter, teams: true })

const rbacContext = createRbacContext({
  rbac,
  getSubject: ({ user }: { user: User | null; req: Request }) => (user ? { type: 'user', id: user.id } : null),
  team: ({ req }) => req.headers.get('x-team-id') ?? undefined,
})

export async function createContext({ req }: { req: Request }) {
  const user = await getUser(req)
  return { user, ...(await rbacContext({ user, req })) }
}
```

::: warning
The team id usually comes from user input (a header, a URL segment, the session). Make sure the user actually
belongs to that team — RBAC Evolution only checks roles and permissions **within** the team you give it. See
[Teams](/basic-usage/teams).
:::

## Guards for an API

`guard` selects which guard's roles and permissions are loaded. For an API with its own credentials, give its
router its own context:

```ts
const apiContext = createRbacContext({
  rbac,
  guard: 'api',
  getSubject: (req: Request) => {
    const clientId = req.headers.get('x-client-id')
    return clientId ? { type: 'client', id: clientId } : null
  },
})

export const createApiContext = async ({ req }: { req: Request }) => apiContext(req)
```

### Another guard per procedure

Every guard also takes a `guard` option: the check runs in that guard (`ctx.rbac.withScope({ guard })`) instead of the
subject's, like spatie's `role:admin,api` / `permission:edit articles,api`. `ctx.rbac` itself is unchanged, and a
guest still gets `UNAUTHORIZED`. `guard` is per procedure only: it is not a `createGuards()` default.

```ts
t.procedure.use(requireRole('admin', { guard: 'api' })) // role:admin,api
t.procedure.use(requirePermission('articles.edit', { guard: 'api' })) // permission:articles.edit,api
t.procedure.use(canAny('reports.view', 'reports.export', { guard: 'api' }))
```

### Names per guard

With [typed names per guard](/basic-usage/typed-names#names-per-guard), `createRbacContext({ rbac, guard: 'api' })`
types `ctx.rbac` with the names of `api`, and `createGuards<AppRbac, 'api'>()` checks the names of the procedures
behind it. A procedure's `{ guard }` option takes the names of that guard:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards, createRbacContext } from '@anievo-id/rbac-evolution-trpc'
import { initTRPC } from '@trpc/server'

type AppRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}

const engine = createRbac<AppRbac>({ adapter })
const apiContext = createRbacContext({
  rbac: engine,
  guard: 'api', // ctx.rbac: the `api` names
  getSubject: (req: Request) => {
    const id = req.headers.get('x-api-key')
    return id ? { type: 'api_key', id } : null
  },
})
const { requirePermission: requireScope } = createGuards<AppRbac, 'api'>()

const api = initTRPC.context<Awaited<ReturnType<typeof apiContext>>>().create()
const orders = api.procedure.use(requireScope('orders.read')).query(async ({ ctx }) => ({
  write: await ctx.rbac.can('orders.write'),
}))

requireScope('api-keys.manage') // type error: a `web` permission
requireScope('api-keys.manage', { guard: 'web' }) // ok: checked in `web`
```

The second type argument of `createGuards()` is a type only: at runtime the subject's guard decides. A `guard` that is
a `string` variable accepts the names of every guard.

See [Multiple guards](/basic-usage/multiple-guards).

## Next.js App Router

tRPC's fetch adapter runs in a Route Handler. The `createContext` of [Setup](#setup) takes the request:

```ts
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createContext } from '@/server/trpc'

const handler = (req: Request) => fetchRequestHandler({ endpoint: '/api/trpc', req, router: appRouter, createContext })

export { handler as GET, handler as POST }
```

Server Components and Server Actions call the router directly, with a context built from the request headers. The
same guards run, so a denied call throws the same `TRPCError`:

```tsx
// app/admin/page.tsx
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { TRPCError } from '@trpc/server'
import { appRouter } from '@/server/routers/_app'
import { createCallerFactory, rbacContext } from '@/server/trpc'

const createCaller = createCallerFactory(appRouter)

export default async function AdminPage() {
  const user = await getUserFromHeaders(await headers()) // your auth
  const caller = createCaller({ user, ...(await rbacContext(user)) })
  try {
    const stats = await caller.admin.stats()
    return <p>{stats.users} users</p>
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'UNAUTHORIZED') redirect('/login')
    if (error instanceof TRPCError && error.code === 'FORBIDDEN') notFound()
    throw error
  }
}
```

The [Next.js package](/frameworks/nextjs) protects pages, layouts and Server Actions that don't go through tRPC, and
the [React package](/frameworks/react) shows or hides UI from `ctx.rbac.snapshot()`.

Full API: [reference](/api/trpc/)

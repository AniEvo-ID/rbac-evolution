# What's new

The highlights of each minor release. Every package shares one version number, so `1.x` of one package works
with `1.x` of all the others. Full details are in the
[changelog](https://github.com/AniEvo-ID/rbac-evolution/blob/main/packages/core/CHANGELOG.md).

## 1.5

- **TanStack Start.** The new `@anievo-id/rbac-evolution-tanstack-start` package guards server functions,
  middleware and server routes: `await rbacServer.requirePermission(getRequest(), 'edit articles')` resolves to the
  subject or throws the usual 401 / 403 `Response`, and a handler can return TanStack Router's `redirect()` for
  pages. See [TanStack Start](/frameworks/tanstack-start).
- **`subjectsWithoutRole()` and `subjectsWithoutPermission()`.** The opposite of `subjectsWithRole()` /
  `subjectsWithPermission()` (spatie's `User::withoutRole()` / `withoutPermission()`): pass candidate ids in
  `among`, get back the ones without any of the roles or permissions. See
  [Querying subjects](/advanced/querying-subjects#subjectswithoutrole-and-subjectswithoutpermission).

## 1.4

- **tRPC.** `@anievo-id/rbac-evolution-trpc` guards tRPC v11 procedures:
  `t.procedure.use(requirePermission('posts.edit'))`, with the same arguments as the other integrations, and
  `ctx.rbac` is a typed, non-null subject after the guard. Denials are `TRPCError`s (`UNAUTHORIZED` /
  `FORBIDDEN`), and `rbacErrorFormatter` sends the usual `reason` to the client. See [tRPC](/frameworks/trpc).
- **SvelteKit.** The new `@anievo-id/rbac-evolution-sveltekit` package adds a `handle` hook that puts the user's
  `SubjectRbac` on `event.locals.rbac`, the usual guards (`requirePermission`, `requireRole`, ...) for `load`
  functions, form actions and `+server.ts` endpoints, with the same 401 / 403 bodies, and Svelte 5 `<Can>` /
  `<HasRole>` components with a runes-based context fed by the root layout. See [SvelteKit](/frameworks/sveltekit).

## 1.3: Prisma 7, Kysely 0.29 and Mongoose 9

Support for the current major versions of three ORMs. The older versions stay supported, and nothing changes on
the rbac side: the same models, tables and options.

- **Prisma 7.** Pass your driver adapter to `new PrismaClient({ adapter })` as Prisma 7 requires, and give the
  client to `PrismaAdapter` as before. Prisma 5.12 and 6 keep working. See [Prisma 7](/adapters/prisma#prisma-7).
- **Kysely 0.29.** `rbacMigration()` and `rbacExpiryMigration()` now return `RbacMigration`, the same shape as
  Kysely's `Migration`, so they work with the `Migrator` from `kysely/migration` (0.29) and from `kysely` (0.28).
- **Mongoose 9.** Mongoose 8 keeps working. On 9, hooks you add to `rbacSchemas()` must be `async`. See
  [Mongoose 9](/adapters/mongoose#mongoose-9).

## 1.2

- **Typed names per guard.** `createRbac<{ guards: { web: {...}; api: {...} }; defaultGuard: 'web' }>()` types the
  roles and permissions of each guard, and every name is checked in the guard you work in:
  `rbac.for(key, { guard: 'api' }).can('api-keys.manage')` is a type error when `api-keys.manage` is a `web`
  permission. `sync()` checks each block against its own guard. Flat configs keep their meaning. See
  [Typed names: names per guard](/basic-usage/typed-names#names-per-guard).
- **Route guards narrow too.** `createGuards<AppRbac, 'api'>()`, `createRbacDecorators<AppRbac, 'api'>()`,
  `createNextRbac({ rbac, guard: 'api' })` and `createRbacServer({ rbac, guard: 'api' })` take the names of the
  request's guard, a route's `{ guard }` option those of that guard, and `isRoleName()` / `isPermissionName()` take
  `{ guard }` (with `names.guards`). See [Multiple guards](/basic-usage/multiple-guards#typed-names-per-guard).
- **Temporary access.** `assignRole()`, `givePermissionTo()` and the syncs take `{ expiresAt }`; from then on every
  check, query, snapshot and cache entry treats the link as gone, and `rbac.pruneExpired()` cleans up. It is opt-in
  per adapter (`{ expiry: true }`, plus one nullable column), so 1.1 databases keep working unchanged. See
  [Temporary access](/basic-usage/temporary-access).

## 1.1: lifecycle, typed requests and audit

No breaking changes: every addition is opt-in, and code written for 1.0 behaves the same.

- **Removing access.** `rbac.for(user).revokeAll()` removes every role and direct permission (optionally in every
  guard and team), `rbac.deleteTeam(teamId)` removes a team's links and roles, and `rbac.for(user).teams()` lists the
  teams a subject has access in. See [Teams](/basic-usage/teams). Custom adapters get three optional methods; see
  [Custom adapter](/adapters/custom).
- **Typed requests.** `req.rbac` (Express, Fastify), `c.var.rbac` (Hono) and `getRbac<T>()` (NestJS) can carry your
  typed names, and `isRoleName(rbac, value)` / `isPermissionName(rbac, value)` check user input against them. See
  [Typed names](/basic-usage/typed-names).
- **Wildcards.** `subjectsWithPermission(name, { expandWildcards: true })` also finds subjects whose wildcard grant
  implies the name, and `wildcardPrefixCheck` warns when a short name like `orders.refund` silently implies
  `orders.refund.large`. See [Wildcard permissions](/basic-usage/wildcard-permissions).
- **`before` hooks in the UI.** `snapshot({ checkBefore: [...] })` sends the names a `before` hook denies, and React,
  Vue and Next.js treat them as not allowed, super-admins included. See [Super-admin](/basic-usage/super-admin).
- **Who made the change.** Write calls take `{ actor }`, the engine takes `getActor`, and every event carries `actor`.
  See [Events](/advanced/events#who-made-the-change-actor).

## 1.0: the stable API

1.0 has no breaking changes from 0.9. What it adds is a promise: the public API of every package only changes in a
breaking way in a new major version, every supported runtime, database and framework version is tested in CI, and
security fixes have a supported version range. See [versioning](/guide/versioning) and, from older releases, the
[upgrade guide](/guide/upgrading).

Since 0.8, closer to spatie/laravel-permission:

- `hasAnyDirectPermission()`, `hasAllDirectPermissions()` and `checkPermissionTo()` on `rbac.for(user)`.
- `findRoleById()`, `findPermissionById()` and `rolesWithPermission()` on the engine.
- `rbac.for(user).withScope({ guard: 'api' })`, and a per-route `guard` option on every integration, like
  `role:admin,api`.
- `<UnlessRole>` in React, like `@unlessrole`.

## 0.8: typed names in every guard

With `createRbac<AppTypes>()`, a typo in a route guard, a Nest decorator, a Next.js or Nuxt server helper or the CLI
seed is now a compile error. Pipe lists are checked part by part:

```ts
const { requirePermission } = createGuards<AppTypes>()
app.put('/articles/:id', requirePermission('articles.edit|articles.publish'), handler) // ok
app.delete('/articles/:id', requirePermission('articles.delte'), handler) // type error
```

Guards called with no names or with options before a name are type errors everywhere, typed names or not. See
[typed names](/basic-usage/typed-names#in-guards-middleware-and-the-cli) and the [upgrade guide](/guide/upgrading).

## 0.7: hardening for 1.0

- **Security:** on MySQL and SQL Server, lookalike subject ids (`'admin '`, and `'ADMIN'` with Prisma on MySQL) no
  longer share another subject's roles. Upgrade if you use string subject ids that users can choose.
- Engine internals are private, and every option accepts an explicit `undefined` (0.7.1).
- New checks behind every release: type tests, package lint (publint, arethetypeswrong), property-based tests of the
  name parsers, a coverage floor, CodeQL and OpenSSF Scorecard. See the [threat model](/best-practices/threat-model).

## 0.6: one set of guard rules everywhere

Express, Fastify, Hono, NestJS and Nuxt used to carry their own copy of the code that reads guard names
(`'a|b'`, several arguments, `{ any }`, `{ all }`). They now share one implementation from core, so every
integration answers the same way for the same names.

The building blocks are public, in case you write an integration of your own:

```ts
import { permissionRequirement, roleRequirement, satisfiesRequirement } from '@anievo-id/rbac-evolution'

const requirement = permissionRequirement(['articles.edit', 'articles.publish|articles.review'])
// [['articles.edit'], ['articles.publish', 'articles.review']]: edit AND (publish OR review)

if (await satisfiesRequirement(rbac.for(user), requirement)) {
  // allowed
}
```

`roleRequirement(names, { all: true })` and `roleOrPermissionRequirement(names)` cover the other two guards.

::: warning Upgrading
A guard whose names are all blank now throws a `TypeError` when it is defined, in every integration, instead of
answering 403 on every request. That covers `requireRole(' | ')`, `requireRoleOrPermission(' ')` and
`requirePermission('', { any: true })`. If names come from configuration, check them before building the guard.
:::

Also in 0.6:

- **Faster lookups on big tables.** `subjectsWithRole()` and `subjectsWithPermission()` remove duplicates in the
  database: `groupBy` with Prisma, an aggregation with Mongoose (no more 16 MB limit).
- **`syncSubjects()` under load.** Two syncs of the same role at the same time no longer leave it without holders.

## 0.5: no flicker while permissions load

When the client fetches the snapshot after the page renders, content guarded by `<Cannot>` or a `not` branch
used to flash for a moment. Tell the provider you are still loading, and the gates render nothing until the
snapshot arrives:

::: code-group

```tsx [React]
const [snapshot, setSnapshot] = useState<RbacSnapshot | null>(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/me/permissions')
    .then((r) => r.json())
    .then(setSnapshot)
    .finally(() => setLoading(false))
}, [])

return (
  <RbacProvider snapshot={snapshot} loading={loading}>
    <App />
  </RbacProvider>
)
```

```ts [Vue]
export const rbac = createRbacPlugin({ loading: true })

// later, once the snapshot is fetched
rbac.setSnapshot(await fetch('/api/me/permissions').then((r) => r.json()))
```

:::

While loading, every check returns `false`, `cannot()` included, and `<Can>`, `<Cannot>`, `<HasRole>`, `v-can` and
`v-role` show neither their content nor their fallback. See [React](/frameworks/react) and [Vue](/frameworks/vue).

## 0.4: spatie v8 parity

### `canAny` / `canAll` guards

Named forms of the two common cases, like the route macros spatie added in v8.5. `canAny` passes with any of the
permissions. `canAll` needs every argument, and a pipe inside one argument still means "any of these".

::: code-group

```ts [Express]
app.put('/articles/:id', canAny('articles.edit', 'articles.publish'), handler)
app.post('/articles/:id/release', canAll('articles.edit', 'articles.publish|articles.review'), handler)
```

```ts [NestJS]
@CanAny('articles.edit', 'articles.publish')
@Put(':id')
update() {}
```

```ts [Nuxt]
export default defineEventHandler(async (event) => {
  await rbacServer.canAll(event, 'articles.edit', 'articles.publish')
})
```

:::

They are also in [Fastify](/frameworks/fastify) and [Hono](/frameworks/hono). Next.js already had the boolean
`canAny()` / `canAll()` helpers and takes `{ all: true }` in its guards and middleware rules.

### `role(...).syncSubjects()`

The spatie `Role::syncModels()` equivalent: make the given subjects of one type the only holders of a role.
Other subject types keep it, and `role.attached` / `role.detached` events fire for each subject.

```ts
await rbac.role('editor').syncSubjects('user', [2, 7]) // only users 2 and 7 are editors now
```

See [Permissions via roles](/basic-usage/roles#syncing-roles) and
[Coming from Laravel](/guide/coming-from-laravel).

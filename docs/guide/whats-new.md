# What's new

The highlights of each minor release. Every package shares one version number, so `0.6.x` of one package works
with `0.6.x` of all the others. Full details are in the
[changelog](https://github.com/AniEvo-ID/rbac-evolution/blob/main/packages/core/CHANGELOG.md).

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

# Testing

This page covers two things:

1. **Testing your app's authorization** with the in-memory adapter. No database is needed.
2. **Testing a custom adapter** against the shared conformance suite.

The examples use [Vitest](https://vitest.dev). The app-level patterns work the same in Jest or `node:test`.

## Testing your app

Use a new [`MemoryAdapter`](/adapters/memory) and a new engine for each test, so tests can't leak state into each other:

```ts
// test/rbac.ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export async function makeRbac() {
  const rbac = createRbac({ adapter: new MemoryAdapter(), cache: false })

  await rbac.createPermission('view articles')
  await rbac.createPermission('edit articles')
  await rbac.createPermission('delete articles')

  await rbac.createRole('writer')
  await rbac.role('writer').givePermissionTo('view articles', 'edit articles')

  await rbac.createRole('admin')
  await rbac.role('admin').givePermissionTo('view articles', 'edit articles', 'delete articles')

  return rbac
}
```

```ts
// articles.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { Rbac } from '@anievo-id/rbac-evolution'
import { makeRbac } from './test/rbac'

describe('article permissions', () => {
  let rbac: Rbac
  const alice = { type: 'user', id: 1 }
  const bob = { type: 'user', id: 2 }

  beforeEach(async () => {
    rbac = await makeRbac()
  })

  it('writers can edit but not delete', async () => {
    await rbac.for(alice).assignRole('writer')

    expect(await rbac.for(alice).can('edit articles')).toBe(true)
    expect(await rbac.for(alice).can('delete articles')).toBe(false)
  })

  it('users without roles can do nothing', async () => {
    expect(await rbac.for(bob).canAny('view articles', 'edit articles')).toBe(false)
  })

  it('throws on unknown permissions in data checks', async () => {
    await expect(rbac.for(alice).hasPermissionTo('publish articles')).rejects.toMatchObject({
      code: 'PERMISSION_DOES_NOT_EXIST',
    })
  })
})
```

::: tip Use `cache: false` in tests
The engine already clears its cache after every change made through it, so tests usually pass either way. With `cache: false` there is one less moving part:

- If a test edits the adapter directly (for example `adapter.attachSubjectRoles(...)` to set up a tricky state), the next check sees the change at once.
- Each check reads straight from the adapter, so a failing test points at your logic, not at a stale entry.

Turn it back on in a dedicated test if you want to check caching behaviour.
:::

### Injecting the engine

Your code is easiest to test when it receives the `rbac` instance instead of importing a global one:

```ts
// articles.ts
import type { Rbac, Subject } from '@anievo-id/rbac-evolution'

export async function deleteArticle(rbac: Rbac, user: Subject, articleId: number) {
  if (await rbac.for(user).cannot('delete articles')) {
    throw new Error('Forbidden')
  }
  // ... delete it
}
```

```ts
it('only admins can delete', async () => {
  const rbac = await makeRbac()
  const writer = { type: 'user', id: 1 }
  await rbac.for(writer).assignRole('writer')

  await expect(deleteArticle(rbac, writer, 42)).rejects.toThrow('Forbidden')
})
```

If your app imports a shared module instead, mock it with `vi.mock('./lib/rbac', ...)` and return an engine built by `makeRbac()`.

### Teams, wildcards and super-admins

Pass the same options as in production so the tests cover the same behaviour:

```ts
const rbac = createRbac({
  adapter: new MemoryAdapter(),
  cache: false,
  teams: true,
  wildcard: true,
  superAdminRoles: ['super-admin'],
})
```

### Asserting events

Listeners are awaited before the method resolves, so you can collect events and assert on them right away:

```ts
import type { RbacEvent } from '@anievo-id/rbac-evolution'

it('emits role.attached once', async () => {
  const rbac = await makeRbac()
  const seen: RbacEvent[] = []
  rbac.on('role.attached', (e) => {
    seen.push(e)
  })

  await rbac.for({ type: 'user', id: 1 }).assignRole('writer')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // already has it → no event

  expect(seen).toHaveLength(1)
  expect(seen[0]).toMatchObject({ event: 'role.attached', roles: [{ name: 'writer' }] })
})
```

See [Events](/advanced/events) for every payload.

## Testing a custom adapter

`@anievo-id/rbac-evolution/testing` exports `runAdapterTests`. It registers a full Vitest suite that checks an adapter against the `RbacAdapter` contract described in [Custom adapter](/adapters/custom).

<!-- doc-test: skip -->
```ts
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'

runAdapterTests(name, factory, options?)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Shown in the report as `RbacAdapter conformance: <name>`. |
| `factory` | `() => RbacAdapter \| Promise<RbacAdapter>` | Called **before every test**. Must return an adapter on **empty** storage. |
| `options.teams` | `boolean` (default `true`) | Set `false` to skip the team-scoping tests. |

What it covers:

- creating and finding permissions and roles by id, name, guard and team (including `null` and empty arrays),
- deleting roles and permissions together with their links,
- idempotent attach, partial and full detach for all link types,
- isolation between subjects, subject types and teams, and string (UUID) subject ids,
- reverse lookups (`getSubjectIdsWithRoles`, `getSubjectIdsWithPermissions`),
- a complete flow through `createRbac` (create, give, assign, `can`).

::: info Requirements
`runAdapterTests` imports `describe`, `it`, `expect` and `beforeEach` from `vitest`. Install Vitest 2 or later as a dev dependency. It is an optional peer dependency of the core package, so you only need it if you use this entry point.
:::

### Examples

Each example gives every test an empty database. Pick the setup that matches your stack:

::: code-group

```ts [SQLite in memory]
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { readFile } from 'node:fs/promises'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { MyAdapter } from '../src/my-adapter'

const ddl = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8')

runAdapterTests('MyAdapter (SQLite)', async () => {
  const client = createClient({ url: ':memory:' }) // fresh database per test
  await client.executeMultiple(ddl)
  return new MyAdapter(drizzle(client))
})
```

```ts [PostgreSQL (PGlite)]
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll } from 'vitest'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { MyAdapter } from '../src/my-adapter'

const client = new PGlite()

beforeAll(async () => {
  await client.exec(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'))
})

runAdapterTests('MyAdapter (PostgreSQL)', async () => {
  await client.exec(
    'TRUNCATE model_has_permissions, model_has_roles, role_has_permissions, roles, permissions RESTART IDENTITY CASCADE',
  )
  return new MyAdapter(client)
})
```

```ts [Prisma]
import { PrismaClient } from '@prisma/client'
import { afterAll } from 'vitest'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

const prisma = new PrismaClient() // point DATABASE_URL at a test database!

afterAll(() => prisma.$disconnect())

runAdapterTests('PrismaAdapter', async () => {
  await prisma.$transaction([
    prisma.rbacModelHasPermission.deleteMany(),
    prisma.rbacModelHasRole.deleteMany(),
    prisma.rbacRoleHasPermission.deleteMany(),
    prisma.rbacRole.deleteMany(),
    prisma.rbacPermission.deleteMany(),
  ])
  return new PrismaAdapter(prisma)
})
```

```ts [MemoryAdapter]
import { MemoryAdapter } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'

runAdapterTests('MemoryAdapter', () => new MemoryAdapter())
```

:::

The Prisma example also shows that you can run the suite against a **built-in** adapter and your real database. It's a quick way to confirm your migrations created the tables correctly.

::: warning Use a separate database
The factory deletes every rbac row before each test. Never point it at a database that holds real data.
:::

### Adding your own tests

`runAdapterTests` only registers a `describe` block, so you can put adapter-specific tests in the same file:

```ts
import { describe, expect, it } from 'vitest'

runAdapterTests('MyAdapter', factory)

describe('MyAdapter specifics', () => {
  it('returns numeric ids', async () => {
    const adapter = await factory()
    const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
    expect(typeof p.id).toBe('number')
  })
})
```

import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import type { RequestEvent } from '@sveltejs/kit'

/**
 * Users: 1 writer, 2 writer + editor, 3 admin (+ `delete articles`), 4 super-admin.
 * User 10 has `admin` and `edit articles` only in guard `api` (spatie's `role:admin,api`).
 * The `before` hook denies `billing.manage` to everyone (also super-admins), like a feature flag.
 */
export async function seededRbac(): Promise<Rbac> {
  const rbac = createRbac({
    adapter: new MemoryAdapter(),
    superAdminRoles: ['super-admin'],
    before: ({ permission }) => (permission === 'billing.manage' ? false : undefined),
  })
  for (const p of ['edit articles', 'delete articles', 'publish articles', 'billing.manage']) await rbac.createPermission(p)
  for (const r of ['writer', 'editor', 'admin', 'super-admin']) await rbac.createRole(r)
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer')
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor')
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
  await rbac.for({ type: 'user', id: 4 }).assignRole('super-admin')

  await rbac.createRole('admin', { guard: 'api' })
  await rbac.createPermission('edit articles', { guard: 'api' })
  await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).assignRole('admin')
  await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).givePermissionTo('edit articles')
  return rbac
}

/** The parts of a `RequestEvent` the helpers and the tests touch; `user` stands in for an auth hook's local. */
export function fakeEvent(user?: number, path = '/admin'): RequestEvent & { locals: { user?: number; rbac?: unknown } } {
  return {
    locals: user === undefined ? {} : { user },
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`),
  } as unknown as RequestEvent & { locals: { user?: number; rbac?: unknown } }
}

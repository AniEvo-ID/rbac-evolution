import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'

export async function seededRbac(): Promise<Rbac> {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('admin')
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
  return rbac
}

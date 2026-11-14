import { describe, expect, it } from 'bun:test'
import './helpers'

const { createRbac, MemoryAdapter, VERSION } = await import('@anievo-id/rbac-evolution')
const { runAdapterTests } = await import('@anievo-id/rbac-evolution/testing')

describe('core on Bun', () => {
  it('runs the full role & permission flow', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), wildcard: true, teams: true, superAdminRoles: ['root'] })
    await rbac.sync({ permissions: ['articles.edit', 'articles.delete'], roles: { writer: ['articles.edit'], root: [] } })

    const alice = rbac.for({ type: 'user', id: 1 })
    await alice.assignRole('writer')
    expect(await alice.can('articles.edit')).toBe(true)
    expect(await alice.can('articles.delete')).toBe(false)

    const admin = rbac.for({ type: 'user', id: 2 })
    await admin.assignRole('root')
    expect(await admin.can('anything.at.all')).toBe(true)

    const inTeam = rbac.for({ type: 'user', id: 3 }, { team: 7 })
    await inTeam.assignRole('writer')
    expect(await inTeam.hasRole('writer')).toBe(true)
    expect(await rbac.for({ type: 'user', id: 3 }).hasRole('writer')).toBe(false)

    expect(await alice.snapshot()).toEqual({ roles: ['writer'], permissions: ['articles.edit'] })
  })

  it('exposes the package version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

runAdapterTests('MemoryAdapter (Bun)', () => new MemoryAdapter())

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, type Rbac, type SyncDefinition } from '@anievo-id/rbac-evolution'
import { defineConfig, formatSyncResult, run, type RbacCliConfig } from '../src'

const seed: SyncDefinition = {
  permissions: ['edit articles', 'delete articles'],
  roles: { admin: '*', writer: ['edit articles'] },
}

describe('sync command', () => {
  let rbac: Rbac
  let config: RbacCliConfig
  let dir: string

  const exec = async (...argv: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const code = await run(argv, {
      cwd: dir,
      config,
      io: { out: (t) => out.push(t), err: (t) => err.push(t) },
    })
    return { code, out: out.join('\n'), err: err.join('\n') }
  }

  beforeEach(() => {
    rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    config = defineConfig({ rbac, seed })
    dir = mkdtempSync(join(tmpdir(), 'rbac-cli-sync-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('syncs the seed from the config and prints a summary', async () => {
    const { code, out } = await exec('sync')
    expect(code).toBe(0)
    expect(out).toContain('+ permission `edit articles` (guard web)')
    expect(out).toContain('+ role `admin` (guard web): edit articles, delete articles')
    expect(out).toContain('+ role `writer` (guard web): edit articles')
    expect(out).toContain('Done: created 2 permissions & 2 roles, updated 0 roles, deleted 0 roles & 0 permissions.')
    expect(await rbac.role('writer').getPermissionNames()).toEqual(['edit articles'])

    expect((await exec('sync')).out).toBe('Already in sync — nothing to do.')
  })

  it('supports spatie-style naming', async () => {
    expect((await exec('permission:sync')).code).toBe(0)
    expect(await rbac.findRole('admin')).not.toBeNull()
  })

  it('--dry-run writes nothing', async () => {
    const { code, out } = await exec('sync', '--dry-run')
    expect(code).toBe(0)
    expect(out).toMatch(/^Dry run — nothing was written\./)
    expect(out).toContain('Would have created 2 permissions & 2 roles')
    expect(await rbac.getPermissions()).toEqual([])
  })

  it('--prune deletes what is not in the seed', async () => {
    await rbac.createRole('old')
    await rbac.createPermission('legacy')
    const { out } = await exec('sync', '--prune')
    expect(out).toContain('- role `old` (guard web)')
    expect(out).toContain('- permission `legacy` (guard web)')
    expect(await rbac.findRole('old')).toBeNull()

    await rbac.createRole('another')
    await exec('sync')
    expect(await rbac.findRole('another')).not.toBeNull()
  })

  it('shows role updates', async () => {
    await exec('sync')
    config = defineConfig({ rbac, seed: { roles: { writer: ['delete articles'] } } })
    expect((await exec('sync')).out).toContain('~ role `writer` (guard web): +delete articles, -edit articles')
  })

  it('applies --guard and --team as defaults', async () => {
    await exec('sync', '--guard', 'api', '--team', '7')
    const role = await rbac.findRoleOrFail('writer', { guard: 'api', team: 7 })
    expect(role.teamId).toBe(7)
  })

  it('prints JSON with --json', async () => {
    const { out } = await exec('sync', '--json', '--dry-run')
    const parsed = JSON.parse(out) as { dryRun: boolean; created: { roles: { name: string }[] } }
    expect(parsed.dryRun).toBe(true)
    expect(parsed.created.roles.map((r) => r.name)).toEqual(['admin', 'writer'])
  })

  it('reads a JSON seed file with --file', async () => {
    writeFileSync(join(dir, 'roles.json'), JSON.stringify({ roles: { editor: ['edit articles'] } }))
    config = defineConfig({ rbac })
    expect((await exec('sync', '--file', 'roles.json')).code).toBe(0)
    expect(await rbac.role('editor').getPermissionNames()).toEqual(['edit articles'])
  })

  it('reads a TypeScript seed file with --file', async () => {
    writeFileSync(
      join(dir, 'roles.ts'),
      `const roles: Record<string, string[] | '*'> = { owner: '*', member: ['read'] }
export default [{ permissions: ['read', 'write'], roles }, { guard: 'api', roles: { bot: ['read'] } }]
`,
    )
    expect((await exec('sync', '-f', 'roles.ts')).code).toBe(0)
    expect((await rbac.role('owner').getPermissionNames()).sort()).toEqual(['read', 'write'])
    expect(await rbac.role('bot', { guard: 'api' }).getPermissionNames()).toEqual(['read'])
  })

  it('fails clearly without a seed, with a missing file or a bad definition', async () => {
    config = defineConfig({ rbac })
    expect(await exec('sync')).toMatchObject({ code: 1, err: expect.stringMatching(/Nothing to sync/) as unknown })
    expect(await exec('sync', '--file', 'nope.json')).toMatchObject({
      code: 1,
      err: expect.stringMatching(/Seed file not found/) as unknown,
    })

    writeFileSync(join(dir, 'broken.json'), '{ nope')
    expect((await exec('sync', '--file', 'broken.json')).err).toMatch(/Could not read broken.json/)

    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ roles: { writer: 'edit' } }))
    const bad = await exec('sync', '--file', 'bad.json')
    expect(bad.code).toBe(1)
    expect(bad.err).toMatch(/must be an array of permission names or '\*'/)
  })

  it('documents sync in the help', async () => {
    expect((await exec('help')).out).toMatch(/sync\s+Create & sync roles and permissions/)
    expect((await exec('help', 'sync')).out).toContain('Usage: rbac-evolution sync [--file roles.json] [--prune] [--dry-run]')
  })
})

describe('formatSyncResult', () => {
  it('labels team scopes', () => {
    const lines = formatSyncResult({
      dryRun: false,
      created: { permissions: [], roles: [{ name: 'owner', guard: 'web', team: 3, permissions: [] }] },
      updated: { roles: [] },
      deleted: { permissions: [], roles: [] },
    })
    expect(lines[0]).toBe('+ role `owner` (guard web, team 3): none')
    expect(lines.at(-1)).toBe('Done: created 0 permissions & 1 role, updated 0 roles, deleted 0 roles & 0 permissions.')
  })
})

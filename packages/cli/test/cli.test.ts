import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import { defineConfig, run, type RbacCliConfig } from '../src'

function capture() {
  const out: string[] = []
  const err: string[] = []
  return { io: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) }, out, err }
}

describe('cli commands', () => {
  let rbac: Rbac
  let config: RbacCliConfig

  const exec = async (...argv: string[]) => {
    const c = capture()
    const code = await run(argv, { io: c.io, config })
    return { code, out: c.out.join('\n'), err: c.err.join('\n') }
  }

  beforeEach(() => {
    rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    config = defineConfig({ rbac })
  })

  it('creates a permission once', async () => {
    expect(await exec('create-permission', 'edit articles')).toMatchObject({
      code: 0,
      out: 'Permission `edit articles` created for guard `web`',
    })
    expect((await exec('create-permission', 'edit articles')).out).toBe(
      'Permission `edit articles` already exists for guard `web`',
    )
    expect(await rbac.findPermission('edit articles')).not.toBeNull()
  })

  it('creates a role with pipe-separated permissions (created if missing)', async () => {
    const result = await exec('create-role', 'writer', 'edit articles|delete articles', 'publish articles')
    expect(result.code).toBe(0)
    expect(result.out).toContain('Role `writer` created for guard `web`')
    expect(await rbac.role('writer').getPermissionNames()).toEqual(
      expect.arrayContaining(['edit articles', 'delete articles', 'publish articles']),
    )

    const again = await exec('create-role', 'writer', 'comment')
    expect(again.out).toContain('Role `writer` already exists')
    expect(await rbac.role('writer').hasPermissionTo('comment')).toBe(true)
  })

  it('supports spatie-style command names', async () => {
    expect((await exec('permission:create-role', 'admin')).code).toBe(0)
    expect(await rbac.findRole('admin')).not.toBeNull()
  })

  it('respects --guard and --team', async () => {
    await exec('create-role', 'manager', '--guard', 'api', '--team', '7')
    const role = await rbac.findRoleOrFail('manager', { guard: 'api', team: 7 })
    expect(role.guardName).toBe('api')
    expect(String(role.teamId)).toBe('7')
  })

  it('assigns roles and gives permissions to subjects', async () => {
    await exec('create-role', 'writer', 'edit articles')
    await exec('create-permission', 'publish articles')

    expect((await exec('assign-role', 'writer', '1')).out).toBe('Role `writer` assigned to user#1')
    expect((await exec('give-permission', 'publish articles', '1')).out).toBe(
      'Permission `publish articles` given to user#1',
    )

    const user = rbac.for({ type: 'user', id: 1 })
    expect(await user.hasRole('writer')).toBe(true)
    expect(await user.can('edit articles')).toBe(true)
    expect(await user.can('publish articles')).toBe(true)
  })

  it('uses --type and config.subjectType', async () => {
    await exec('create-role', 'bot')
    await exec('assign-role', 'bot', 'abc', '--type', 'client')
    expect(await rbac.for({ type: 'client', id: 'abc' }).hasRole('bot')).toBe(true)

    config = defineConfig({ rbac, subjectType: 'admin' })
    await exec('assign-role', 'bot', '9')
    expect(await rbac.for({ type: 'admin', id: 9 }).hasRole('bot')).toBe(true)
  })

  it('reports core errors with exit code 1', async () => {
    const result = await exec('assign-role', 'ghost', '1')
    expect(result.code).toBe(1)
    expect(result.err).toMatch(/There is no role named `ghost`/)
  })

  it('shows the permission matrix per guard', async () => {
    await exec('create-role', 'writer', 'edit articles|delete articles')
    await exec('create-role', 'editor', 'edit articles')
    await exec('create-permission', 'manage api', '--guard', 'api')

    const { code, out } = await exec('show')
    expect(code).toBe(0)
    expect(out).toContain('Guard: api')
    expect(out).toContain('Guard: web')
    expect(out).toMatch(/│ Permission\s+│ editor │ writer │/)
    expect(out).toMatch(/│ delete articles │ ·\s+│ ✔\s+│/)
    expect(out).toMatch(/│ edit articles\s+│ ✔\s+│ ✔\s+│/)
  })

  it('shows JSON output', async () => {
    await exec('create-role', 'writer', 'edit articles')
    const { out } = await exec('show', '--json', '--guard', 'web')
    expect(JSON.parse(out)).toEqual([
      {
        guard: 'web',
        permissions: ['edit articles'],
        roles: [{ name: 'writer', teamId: null, permissions: ['edit articles'] }],
      },
    ])
  })

  it('resets the cache', async () => {
    expect((await exec('cache-reset')).out).toBe('Permission cache flushed.')
  })

  it('runs teardown after a command', async () => {
    let tornDown = 0
    config = defineConfig({ rbac, teardown: () => void tornDown++ })
    await exec('cache-reset')
    expect(tornDown).toBe(1)
  })

  it('handles help, version and usage errors', async () => {
    expect((await exec()).out).toContain('Usage: rbac-evolution <command>')
    expect((await exec('help', 'create-role')).out).toContain('Usage: rbac-evolution create-role')
    expect((await exec('--version')).code).toBe(0)
    expect(await exec('nope')).toMatchObject({ code: 2 })
    expect(await exec('create-role')).toMatchObject({ code: 2, err: 'Error: Missing role name.' })
    expect((await exec('show', '--wat')).code).toBe(2)
  })
})

describe('config loading', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rbac-cli-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('init writes a config template', async () => {
    const c = capture()
    expect(await run(['init'], { cwd: dir, io: c.io })).toBe(0)
    expect(readFileSync(join(dir, 'rbac.config.ts'), 'utf8')).toContain('defineConfig')
    expect(await run(['init'], { cwd: dir, io: c.io })).toBe(1)
    expect(await run(['init', '--force'], { cwd: dir, io: c.io })).toBe(0)
  })

  it('loads a TypeScript rbac.config.ts', async () => {
    writeFileSync(
      join(dir, 'rbac.config.ts'),
      `const permissions: string[] = []
export default {
  rbac: {
    for: () => ({}),
    createRole: async () => ({}),
    forgetCachedPermissions: async () => { permissions.push('flushed') },
  },
} satisfies { rbac: unknown }
`,
    )
    const c = capture()
    expect(await run(['cache-reset'], { cwd: dir, io: c.io })).toBe(0)
    expect(c.out).toEqual(['Permission cache flushed.'])
  })

  it('fails clearly without a config', async () => {
    const c = capture()
    expect(await run(['show'], { cwd: dir, io: c.io })).toBe(1)
    expect(c.err.join('')).toMatch(/No rbac.config.ts found/)
  })

  it('rejects a config without rbac', async () => {
    writeFileSync(join(dir, 'rbac.config.mjs'), 'export default { nope: true }\n')
    const c = capture()
    expect(await run(['show'], { cwd: dir, io: c.io })).toBe(1)
    expect(c.err.join('')).toMatch(/must default-export defineConfig/)
  })
})

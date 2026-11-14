import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cli = new URL('../../packages/cli/dist/cli.js', import.meta.url).pathname

// The config lives inside this package so it can resolve the workspace packages.
const dir = mkdtempSync(join(import.meta.dir, '.tmp-cli-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, 'rbac.config.ts'),
  `import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'

const rbac = createRbac({ adapter: new MemoryAdapter() })

export default defineConfig({
  rbac,
  seed: { permissions: ['edit articles'], roles: { writer: ['edit articles'], admin: '*' } },
})
`,
)

function run(...args: string[]) {
  const proc = Bun.spawnSync(['bun', cli, ...args], { cwd: dir })
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() }
}

describe('CLI under the Bun runtime', () => {
  it('prints its version', () => {
    const { code, out } = run('--version')
    expect(code).toBe(0)
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('loads a TypeScript rbac.config.ts and syncs the seed', () => {
    const { code, out, err } = run('sync')
    expect(err).toBe('')
    expect(code).toBe(0)
    expect(out).toContain('writer')
  })

  it('exits with 2 on unknown commands', () => {
    expect(run('nope').code).toBe(2)
  })
})

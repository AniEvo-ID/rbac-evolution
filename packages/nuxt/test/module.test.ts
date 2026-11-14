import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../src/module.ts', import.meta.url))
const runtimeDir = fileURLToPath(new URL('../src/runtime', import.meta.url))

// Loads a real (empty) Nuxt app with the module installed — no build, no server.
describe('Nuxt module setup', () => {
  let nuxt: Nuxt
  let rootDir: string

  beforeAll(async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'rbac-nuxt-'))
    nuxt = await loadNuxt({
      // `cwd` locates the installed Nuxt; the app itself lives in an empty temp dir.
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      dev: false,
      ready: true,
      overrides: {
        rootDir,
        modules: [modulePath],
        // @ts-expect-error -- module config key, typed only in a generated Nuxt project
        rbac: { wildcard: true, superAdminRoles: ['super-admin'], forbiddenRedirect: '/403' },
        telemetry: false,
      },
    })
  })

  afterAll(async () => {
    await nuxt?.close()
    rmSync(rootDir, { recursive: true, force: true })
  })

  it('exposes the options in runtimeConfig.public.rbac', () => {
    expect(nuxt.options.runtimeConfig.public['rbac']).toEqual({
      wildcard: true,
      superAdminRoles: ['super-admin'],
      directives: true,
      components: true,
      globalProperties: true,
      unauthenticatedRedirect: '',
      forbiddenRedirect: '/403',
    })
  })

  it('registers the plugin', () => {
    const plugins = nuxt.options.plugins.map((p) => (typeof p === 'string' ? p : p.src))
    // Nuxt normalizes the path and appends the resolved extension.
    expect(plugins.some((src) => src.replace(/\.[cm]?[jt]s$/, '') === join(runtimeDir, 'plugin'))).toBe(true)
  })

  it('auto-imports the composables', async () => {
    const imports: { name: string; from: string }[] = []
    await nuxt.callHook('imports:extend', imports as never)
    const ours = imports.filter((i) => i.from === join(runtimeDir, 'composables')).map((i) => i.name)
    expect(ours).toEqual(expect.arrayContaining(['useRbac', 'useCan', 'useCannot', 'useHasRole', 'useHasAllRoles']))
  })

  it('registers the global rbac route middleware', async () => {
    const app = { middleware: [] as { name: string; path: string; global?: boolean }[] }
    await nuxt.callHook('app:resolve', app as never)
    expect(app.middleware).toContainEqual(
      expect.objectContaining({ name: 'rbac', path: join(runtimeDir, 'middleware'), global: true }),
    )
  })

  it('transpiles the runtime directory', () => {
    expect(nuxt.options.build.transpile).toContain(runtimeDir)
  })
})

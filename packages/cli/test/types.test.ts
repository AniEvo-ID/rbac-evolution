/**
 * Type tests for the public API of the CLI package. Most assertions are type-level: they (and the
 * `@ts-expect-error` lines) are checked by `tsc --noEmit` (the `typecheck` script). No database is used
 * (MemoryAdapter), and no command is run.
 */
import {
  type DefaultRbacTypes,
  type Rbac,
  type SyncDefinition,
  type SyncResult,
  createRbac,
  MemoryAdapter,
} from '@anievo-id/rbac-evolution'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CONFIG_FILES,
  CliError,
  defineConfig,
  findConfigFile,
  formatSyncResult,
  type Io,
  loadConfig,
  type RbacCliConfig,
  type RunOptions,
  run,
  UsageError,
  VERSION,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })

describe('cli: types', () => {
  it('defineConfig takes and returns RbacCliConfig', () => {
    expectTypeOf(defineConfig<DefaultRbacTypes>).parameters.toEqualTypeOf<[config: RbacCliConfig]>()
    expectTypeOf(defineConfig<DefaultRbacTypes>).returns.toEqualTypeOf<RbacCliConfig>()

    expectTypeOf<RbacCliConfig['rbac']>().toEqualTypeOf<Rbac | (() => Rbac | Promise<Rbac>)>()
    expectTypeOf<RbacCliConfig['subjectType']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<RbacCliConfig['seed']>().toEqualTypeOf<SyncDefinition | readonly SyncDefinition[] | undefined>()
    expectTypeOf<RbacCliConfig['teardown']>().toEqualTypeOf<(() => void | Promise<void>) | undefined>()

    // every documented form of `rbac`
    const config = defineConfig({ rbac })
    expect(config.rbac).toBe(rbac)
    defineConfig({ rbac: () => rbac })
    defineConfig({ rbac: async () => createRbac({ adapter: new MemoryAdapter(), teams: true }) })
    defineConfig({
      rbac,
      subjectType: 'admin',
      seed: [{ guard: 'web', permissions: ['edit'], roles: { admin: '*', writer: ['edit'] } }, { guard: 'api' }],
      teardown: async () => {},
    })
    defineConfig({ rbac, seed: { permissions: ['edit'] } as const })
  })

  it('defineConfig accepts an Rbac with typed names', () => {
    const typed = createRbac<{ permissions: 'edit articles'; roles: 'writer' }>({ adapter: new MemoryAdapter() })
    expectTypeOf(defineConfig).toBeCallableWith({ rbac: typed })
    expectTypeOf(defineConfig).toBeCallableWith({ rbac: () => typed })
    expectTypeOf(defineConfig).toBeCallableWith({ rbac: async () => typed })
  })

  it('checks the names in `seed` against a typed engine', () => {
    type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }
    const typed = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
    const config = defineConfig({
      rbac: typed,
      seed: { permissions: ['edit articles', 'delete articles'], roles: { admin: '*', writer: ['edit articles'] } },
    })
    expectTypeOf(config).toEqualTypeOf<RbacCliConfig<AppTypes>>()
    defineConfig({ rbac: async () => typed, seed: [{ permissions: ['edit articles'] }] })

    // Never called: only type-checked.
    const _bad = () => {
      // @ts-expect-error unknown permission in seed
      defineConfig({ rbac: typed, seed: { permissions: ['edit artciles'] } })
      // @ts-expect-error unknown role in seed
      defineConfig({ rbac: () => typed, seed: { roles: { editor: '*' } } })
    }
    expect(typeof _bad).toBe('function')
  })

  it('RbacCliConfig rejects invalid configs (exactOptionalPropertyTypes)', () => {
    // Never called: only type-checked.
    const _bad = () => {
      // @ts-expect-error `rbac` is required
      defineConfig({})
      // @ts-expect-error not an Rbac instance
      defineConfig({ rbac: new MemoryAdapter() })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      defineConfig({ rbac, subjectType: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      defineConfig({ rbac, seed: undefined })
      // @ts-expect-error `roles` maps role names to permission lists or '*'
      defineConfig({ rbac, seed: { roles: { admin: 'all' } } })
      // @ts-expect-error unknown key
      defineConfig({ rbac, adapter: new MemoryAdapter() })
    }
    expect(typeof _bad).toBe('function')
  })

  it('run / RunOptions / Io', () => {
    expectTypeOf(run).parameters.toEqualTypeOf<[argv: readonly string[], options?: RunOptions]>()
    expectTypeOf(run).returns.toEqualTypeOf<Promise<number>>()
    expectTypeOf<RunOptions>().toEqualTypeOf<{ cwd?: string; io?: Io; config?: RbacCliConfig }>()
    expectTypeOf<Io>().toEqualTypeOf<{ out(text: string): void; err(text: string): void }>()

    const out: string[] = []
    const io: Io = { out: (t) => out.push(t), err: () => {} } // returning a value from `out` is fine
    expectTypeOf(run).toBeCallableWith(['list'])
    expectTypeOf(run).toBeCallableWith(['role', 'create', 'writer'] as const, { io, config: defineConfig({ rbac }) })
    expectTypeOf(run).toBeCallableWith(process.argv.slice(2), { cwd: '/tmp' })

    // Never called: only type-checked.
    const _bad = () => {
      // @ts-expect-error argv is an array of strings
      void run('list')
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      void run([], { cwd: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      void run([], { io: undefined })
      // @ts-expect-error Io needs both `out` and `err`
      void run([], { io: { out: () => {} } })
    }
    expect(typeof _bad).toBe('function')
  })

  it('error classes', () => {
    const usage = new UsageError('bad args')
    expect(usage).toBeInstanceOf(CliError)
    expect(usage.exitCode).toBe(2)
    expectTypeOf(usage).toMatchTypeOf<CliError>()
    expectTypeOf(usage).toMatchTypeOf<Error>()
    expectTypeOf<CliError['exitCode']>().toEqualTypeOf<number>()
    expectTypeOf(CliError).constructorParameters.toEqualTypeOf<[message: string, exitCode?: number]>()
    expectTypeOf(UsageError).constructorParameters.toEqualTypeOf<[message: string]>()

    const _bad = () => {
      // @ts-expect-error UsageError always exits with 2
      new UsageError('bad args', 3)
      // @ts-expect-error exitCode is readonly
      usage.exitCode = 1
    }
    expect(typeof _bad).toBe('function')
  })

  it('helpers: loadConfig, findConfigFile, CONFIG_FILES, formatSyncResult, VERSION', () => {
    expectTypeOf(loadConfig).returns.toEqualTypeOf<Promise<RbacCliConfig>>()
    expectTypeOf(loadConfig).parameters.toEqualTypeOf<[cwd: string, explicit?: string]>()
    expectTypeOf(findConfigFile).returns.toEqualTypeOf<string | undefined>()
    expectTypeOf(CONFIG_FILES).toEqualTypeOf<
      readonly ['rbac.config.ts', 'rbac.config.mts', 'rbac.config.cts', 'rbac.config.js', 'rbac.config.mjs', 'rbac.config.cjs']
    >()
    expectTypeOf(formatSyncResult).parameters.toEqualTypeOf<[result: SyncResult]>()
    expectTypeOf(formatSyncResult).returns.toEqualTypeOf<string[]>()
    expectTypeOf(VERSION).toEqualTypeOf<string>()
  })
})

describe('cli: per-guard names (1.2)', () => {
  type GuardedRbac = {
    guards: {
      web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
      api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
    }
    defaultGuard: 'web'
  }

  it('checks each seed block against the names of its guard', () => {
    const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })
    defineConfig({
      rbac: guarded,
      seed: [
        { permissions: ['articles.edit', 'api-keys.manage'], roles: { admin: '*' } },
        { guard: 'api', permissions: ['orders.read', 'orders.write'], roles: { 'read-only': ['orders.read'] } },
      ],
    })
    const _bad = () => {
      defineConfig({
        rbac: guarded,
        // @ts-expect-error -- `admin` is a `web` role
        seed: { guard: 'api', roles: { admin: '*' } },
      })
    }
    expect(typeof _bad).toBe('function')
  })
})

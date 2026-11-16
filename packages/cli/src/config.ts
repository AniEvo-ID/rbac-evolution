import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Rbac, SyncDefinition } from '@anievo-id/rbac-evolution'
import { CliError } from './errors'

export interface RbacCliConfig {
  /**
   * The `Rbac` instance (with your storage adapter) the CLI operates on —
   * or a function returning it, so connections are only opened when a command runs.
   */
  rbac: Rbac | (() => Rbac | Promise<Rbac>)
  /** Default subject type for `assign-role` / `give-permission` (spatie's user model). Default: `user`. */
  subjectType?: string | undefined
  /**
   * Roles & permissions for `rbac-evolution sync` — the same shape as `rbac.sync()`:
   * one definition, or an array of definitions (one per guard / team).
   */
  seed?: SyncDefinition | readonly SyncDefinition[] | undefined
  /** Called after every command, e.g. to close the database connection. */
  teardown?: (() => void | Promise<void>) | undefined
}

/** Type helper for `rbac.config.ts`. */
export function defineConfig(config: RbacCliConfig): RbacCliConfig {
  return config
}

export const CONFIG_FILES = [
  'rbac.config.ts',
  'rbac.config.mts',
  'rbac.config.cts',
  'rbac.config.js',
  'rbac.config.mjs',
  'rbac.config.cjs',
] as const

export function findConfigFile(cwd: string, explicit?: string): string | undefined {
  if (explicit !== undefined) {
    const file = isAbsolute(explicit) ? explicit : resolve(cwd, explicit)
    if (!existsSync(file)) throw new CliError(`Config file not found: ${explicit}`)
    return file
  }
  return CONFIG_FILES.map((name) => join(cwd, name)).find((file) => existsSync(file))
}

/** Imports a TS/JS module with jiti and returns its default export. */
export async function importModule(file: string): Promise<unknown> {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(pathToFileURL(file).href, { interopDefault: true })
  return jiti.import(file, { default: true })
}

/** Loads `rbac.config.*` (TypeScript supported via jiti). */
export async function loadConfig(cwd: string, explicit?: string): Promise<RbacCliConfig> {
  const file = findConfigFile(cwd, explicit)
  if (!file) {
    throw new CliError('No rbac.config.ts found in this directory. Run `rbac-evolution init` to create one.')
  }

  const loaded = await importModule(file)

  if (!isConfig(loaded)) {
    throw new CliError(`${file} must default-export defineConfig({ rbac }).`)
  }
  return loaded
}

export async function resolveRbac(config: RbacCliConfig): Promise<Rbac> {
  const rbac = typeof config.rbac === 'function' ? await config.rbac() : config.rbac
  // duck-typed: the user's config may load a different copy of the core package
  if (!rbac || typeof rbac !== 'object' || typeof rbac.for !== 'function' || typeof rbac.createRole !== 'function') {
    throw new CliError('`rbac` in the config is not an Rbac instance (use createRbac from @anievo-id/rbac-evolution).')
  }
  return rbac
}

function isConfig(value: unknown): value is RbacCliConfig {
  return typeof value === 'object' && value !== null && 'rbac' in value
}

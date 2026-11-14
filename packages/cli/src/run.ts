import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type {
  Id,
  Rbac,
  Role,
  ScopeOptions,
  SyncDefinition,
  SyncOptions,
  SyncResult,
  TeamId,
} from '@anievo-id/rbac-evolution'
import { importModule, loadConfig, resolveRbac, type RbacCliConfig } from './config'
import { CliError, UsageError } from './errors'
import { renderTable } from './table'

declare const __CLI_VERSION__: string | undefined
export const VERSION: string = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0-dev'

export interface Io {
  out(text: string): void
  err(text: string): void
}

export interface RunOptions {
  /** Working directory used to find `rbac.config.*`. Default: `process.cwd()`. */
  cwd?: string
  /** Output streams. Default: stdout / stderr. */
  io?: Io
  /** Use this config instead of loading `rbac.config.*` (handy for tests and scripts). */
  config?: RbacCliConfig
}

const defaultIo: Io = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
}

const OPTIONS = {
  config: { type: 'string', short: 'c' },
  guard: { type: 'string', short: 'g' },
  team: { type: 'string', short: 't' },
  type: { type: 'string' },
  json: { type: 'boolean' },
  force: { type: 'boolean' },
  file: { type: 'string', short: 'f' },
  prune: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const

type Flags = {
  config?: string | undefined
  guard?: string | undefined
  team?: string | undefined
  type?: string | undefined
  json?: boolean | undefined
  force?: boolean | undefined
  file?: string | undefined
  prune?: boolean | undefined
  'dry-run'?: boolean | undefined
  yes?: boolean | undefined
  help?: boolean | undefined
  version?: boolean | undefined
}

interface Context {
  args: string[]
  flags: Flags
  io: Io
  cwd: string
  options: RunOptions
}

interface Command {
  usage: string
  description: string
  needsRbac: boolean
  run(ctx: Context, rbac: Rbac, config: RbacCliConfig): Promise<void>
}

const COMMANDS: Record<string, Command> = {
  init: {
    usage: 'init [--force]',
    description: 'Create an rbac.config.ts in the current directory',
    needsRbac: false,
    async run({ cwd, flags, io }) {
      const file = join(cwd, 'rbac.config.ts')
      if (existsSync(file) && !flags.force) throw new CliError('rbac.config.ts already exists (use --force to overwrite).')
      writeFileSync(file, CONFIG_TEMPLATE)
      io.out('Created rbac.config.ts — point it at the same adapter your app uses.')
    },
  },

  'create-permission': {
    usage: 'create-permission <name> [--guard web]',
    description: 'Create a permission (skipped if it already exists)',
    needsRbac: true,
    async run({ args, flags, io }, rbac) {
      const name = requireArg(args[0], 'permission name')
      const guard = flags.guard
      const existing = await rbac.findPermission(name, guardOpt(guard))
      if (existing) {
        io.out(`Permission \`${existing.name}\` already exists for guard \`${existing.guardName}\``)
        return
      }
      const permission = await rbac.createPermission(name, guardOpt(guard))
      io.out(`Permission \`${permission.name}\` created for guard \`${permission.guardName}\``)
    },
  },

  'create-role': {
    usage: 'create-role <name> ["perm-a|perm-b"] [--guard web] [--team 1]',
    description: 'Create a role, optionally with permissions (missing permissions are created)',
    needsRbac: true,
    async run({ args, flags, io }, rbac) {
      const name = requireArg(args[0], 'role name')
      const scope = scopeOpt(flags)
      const role = await createOrFindRole(rbac, name, scope, io)

      const permissions = splitList(args.slice(1))
      if (permissions.length === 0) return
      for (const permission of permissions) {
        await rbac.findOrCreatePermission(permission, { guard: role.guardName })
      }
      await rbac.role(role).givePermissionTo(permissions)
      io.out(`Permissions ${permissions.map((p) => `\`${p}\``).join(', ')} given to role \`${role.name}\``)
    },
  },

  'assign-role': {
    usage: 'assign-role <role> <subject-id> [--type user] [--guard web] [--team 1]',
    description: 'Assign a role to a subject (e.g. a user)',
    needsRbac: true,
    async run({ args, flags, io }, rbac, config) {
      const role = requireArg(args[0], 'role name')
      const subject = { type: flags.type ?? config.subjectType ?? 'user', id: parseId(requireArg(args[1], 'subject id')) }
      await rbac.for(subject, scopeOpt(flags)).assignRole(role)
      io.out(`Role \`${role}\` assigned to ${subject.type}#${String(subject.id)}${teamSuffix(flags)}`)
    },
  },

  'give-permission': {
    usage: 'give-permission <permission> <subject-id> [--type user] [--guard web] [--team 1]',
    description: 'Give a direct permission to a subject',
    needsRbac: true,
    async run({ args, flags, io }, rbac, config) {
      const permission = requireArg(args[0], 'permission name')
      const subject = { type: flags.type ?? config.subjectType ?? 'user', id: parseId(requireArg(args[1], 'subject id')) }
      await rbac.for(subject, scopeOpt(flags)).givePermissionTo(permission)
      io.out(`Permission \`${permission}\` given to ${subject.type}#${String(subject.id)}${teamSuffix(flags)}`)
    },
  },

  show: {
    usage: 'show [--guard web] [--team 1] [--json]',
    description: 'Show roles and their permissions per guard',
    needsRbac: true,
    async run({ flags, io }, rbac) {
      const guard = flags.guard
      const team = flags.team === undefined ? undefined : parseId(flags.team)
      const permissions = await rbac.adapter.findPermissions(guard === undefined ? {} : { guardName: guard })
      const roles = await rbac.adapter.findRoles({
        ...(guard === undefined ? {} : { guardName: guard }),
        ...(team === undefined ? {} : { teamIds: [team, null] }),
      })
      const links = roles.length > 0 ? await rbac.adapter.getRolePermissionLinks(roles.map((r) => r.id)) : []
      const has = new Set(links.map((l) => `${String(l.roleId)}:${String(l.permissionId)}`))

      const guards = [...new Set([...permissions, ...roles].map((x) => x.guardName))].sort()
      if (guard !== undefined && !guards.includes(guard)) guards.push(guard)

      const report = guards.map((g) => {
        const ps = permissions.filter((p) => p.guardName === g).sort((a, b) => a.name.localeCompare(b.name))
        const rs = roles.filter((r) => r.guardName === g).sort((a, b) => a.name.localeCompare(b.name))
        return { guard: g, permissions: ps, roles: rs }
      })

      if (flags.json) {
        io.out(
          JSON.stringify(
            report.map(({ guard: g, permissions: ps, roles: rs }) => ({
              guard: g,
              permissions: ps.map((p) => p.name),
              roles: rs.map((r) => ({
                name: r.name,
                teamId: r.teamId,
                permissions: ps.filter((p) => has.has(`${String(r.id)}:${String(p.id)}`)).map((p) => p.name),
              })),
            })),
            null,
            2,
          ),
        )
        return
      }

      if (report.length === 0) {
        io.out('No roles or permissions yet.')
        return
      }
      report.forEach(({ guard: g, permissions: ps, roles: rs }, i) => {
        if (i > 0) io.out('')
        io.out(`Guard: ${g}`)
        if (ps.length === 0 && rs.length === 0) {
          io.out('No roles or permissions yet.')
          return
        }
        const head = ['Permission', ...rs.map(roleLabel)]
        const rows = ps.map((p) => [p.name, ...rs.map((r) => (has.has(`${String(r.id)}:${String(p.id)}`) ? '✔' : '·'))])
        io.out(renderTable(head, rows.length > 0 ? rows : [['(none)', ...rs.map(() => '')]]))
      })
    },
  },

  sync: {
    usage: 'sync [--file roles.json] [--prune --yes] [--dry-run] [--guard web] [--team 1] [--json]',
    description: 'Create & sync roles and permissions from `seed` in the config (or --file)',
    needsRbac: true,
    async run({ cwd, flags, io }, rbac, config) {
      const definition = flags.file === undefined ? config.seed : await loadSeedFile(cwd, flags.file)
      if (definition === undefined) {
        throw new CliError('Nothing to sync: add `seed` to rbac.config.ts or pass --file roles.json.')
      }
      if (typeof (rbac as Partial<Rbac>).sync !== 'function') {
        throw new CliError('`sync` needs @anievo-id/rbac-evolution 0.3 or later in your project.')
      }

      // Pruning deletes roles and permissions; a typo in --file must not wipe them without asking.
      if (flags.prune && !flags['dry-run'] && !flags.yes) {
        throw new CliError(
          '`sync --prune` deletes every role and permission that is not in the seed.\n' +
            'Preview it with `--dry-run`, then re-run with `--yes` to apply.',
        )
      }

      const options: SyncOptions = { ...scopeOpt(flags) }
      if (flags.prune) options.prune = true
      if (flags['dry-run']) options.dryRun = true
      const result = await rbac.sync(definition, options)

      if (flags.json) {
        io.out(JSON.stringify(result, null, 2))
        return
      }
      for (const line of formatSyncResult(result)) io.out(line)
    },
  },

  'cache-reset': {
    usage: 'cache-reset',
    description: 'Flush the permission cache (useful with a shared cache like Redis)',
    needsRbac: true,
    async run({ io }, rbac) {
      await rbac.forgetCachedPermissions()
      io.out('Permission cache flushed.')
    },
  },
}

/**
 * Runs the CLI. Returns the exit code instead of exiting, so it can be used programmatically.
 *
 * Commands may also be written spatie-style: `permission:create-role` = `create-role`.
 */
export async function run(argv: readonly string[], options: RunOptions = {}): Promise<number> {
  const io = options.io ?? defaultIo
  const cwd = options.cwd ?? process.cwd()

  try {
    const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true, strict: true })
    const flags = values as Flags
    const [rawCommand, ...args] = positionals

    if (flags.version) {
      io.out(VERSION)
      return 0
    }
    if (rawCommand === undefined || rawCommand === 'help') {
      io.out(helpText(args[0]))
      return 0
    }

    const name = rawCommand.replace(/^permission:/, '')
    const command = COMMANDS[name]
    if (!command) throw new UsageError(`Unknown command "${rawCommand}". Run \`rbac-evolution help\`.`)
    if (flags.help) {
      io.out(helpText(name))
      return 0
    }

    const ctx: Context = { args, flags, io, cwd, options }
    if (!command.needsRbac) {
      await command.run(ctx, undefined as never, undefined as never)
      return 0
    }

    const config = options.config ?? (await loadConfig(cwd, flags.config))
    try {
      const rbac = await resolveRbac(config)
      await command.run(ctx, rbac, config)
    } finally {
      await config.teardown?.()
    }
    return 0
  } catch (error) {
    if (error instanceof CliError) {
      io.err(`Error: ${error.message}`)
      return error.exitCode
    }
    // Node's parseArgs errors (unknown option, missing value)
    if (error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')) {
      io.err(`Error: ${error.message}`)
      return 2
    }
    // RbacError from core (RoleDoesNotExist, GuardDoesNotMatch, ...) — duck-typed across package copies
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      io.err(`Error: ${error.message}`)
      return 1
    }
    throw error
  }
}

// ----------------------------------------------------------------------------- helpers

async function createOrFindRole(rbac: Rbac, name: string, scope: ScopeOptions, io: Io): Promise<Role> {
  try {
    const role = await rbac.createRole(name, scope)
    io.out(`Role \`${role.name}\` created for guard \`${role.guardName}\`${role.teamId === null ? '' : ` (team ${String(role.teamId)})`}`)
    return role
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ROLE_ALREADY_EXISTS') {
      const role = await rbac.findRoleOrFail(name, scope)
      io.out(`Role \`${role.name}\` already exists`)
      return role
    }
    throw error
  }
}

async function loadSeedFile(cwd: string, path: string): Promise<SyncDefinition | SyncDefinition[]> {
  const file = isAbsolute(path) ? path : resolve(cwd, path)
  if (!existsSync(file)) throw new CliError(`Seed file not found: ${path}`)
  let loaded: unknown
  try {
    loaded = extname(file) === '.json' ? JSON.parse(readFileSync(file, 'utf8')) : await importModule(file)
  } catch (error) {
    throw new CliError(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof loaded !== 'object' || loaded === null) {
    throw new CliError(`${path} must contain (or default-export) a sync definition object or array.`)
  }
  // validated in depth by rbac.sync()
  return loaded as SyncDefinition | SyncDefinition[]
}

/** Human-readable lines for a sync result. */
export function formatSyncResult(result: SyncResult): string[] {
  const scope = (x: { guard: string; team?: TeamId }): string =>
    x.team === undefined || x.team === null ? `guard ${x.guard}` : `guard ${x.guard}, team ${String(x.team)}`
  const list = (names: readonly string[]): string => (names.length === 0 ? 'none' : names.join(', '))
  const lines: string[] = []
  if (result.dryRun) lines.push('Dry run — nothing was written.', '')

  const { created, updated, deleted } = result
  for (const p of created.permissions) lines.push(`+ permission \`${p.name}\` (${scope(p)})`)
  for (const r of created.roles) lines.push(`+ role \`${r.name}\` (${scope(r)}): ${list(r.permissions)}`)
  for (const r of updated.roles) {
    const diff = [...r.attached.map((p) => `+${p}`), ...r.detached.map((p) => `-${p}`)].join(', ')
    lines.push(`~ role \`${r.name}\` (${scope(r)}): ${diff}`)
  }
  for (const r of deleted.roles) lines.push(`- role \`${r.name}\` (${scope(r)})`)
  for (const p of deleted.permissions) lines.push(`- permission \`${p.name}\` (${scope(p)})`)

  const total =
    created.permissions.length + created.roles.length + updated.roles.length + deleted.roles.length + deleted.permissions.length
  if (total === 0) {
    lines.push('Already in sync — nothing to do.')
    return lines
  }
  const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
  const verb = result.dryRun ? 'Would have' : 'Done:'
  lines.push(
    '',
    `${verb} created ${count(created.permissions.length, 'permission')} & ${count(created.roles.length, 'role')}, ` +
      `updated ${count(updated.roles.length, 'role')}, ` +
      `deleted ${count(deleted.roles.length, 'role')} & ${count(deleted.permissions.length, 'permission')}.`,
  )
  return lines
}

function requireArg(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === '') throw new UsageError(`Missing ${label}.`)
  return value
}

/** `'a|b' 'c'` → `['a', 'b', 'c']` (spatie uses `|` to separate names). */
function splitList(values: readonly string[]): string[] {
  return values
    .flatMap((v) => v.split('|'))
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

/**
 * Numeric-looking ids become numbers only when that is lossless: `9007199254740993` (beyond
 * Number.MAX_SAFE_INTEGER) and `007` stay strings, so they can't silently point at another subject.
 */
export function parseId(value: string): Id {
  if (!/^(0|[1-9]\d*)$/.test(value)) return value
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : value
}

function guardOpt(guard: string | undefined): { guard?: string } {
  return guard === undefined ? {} : { guard }
}

function scopeOpt(flags: Flags): ScopeOptions {
  const scope: ScopeOptions = {}
  if (flags.guard !== undefined) scope.guard = flags.guard
  if (flags.team !== undefined) scope.team = parseId(flags.team) as TeamId
  return scope
}

function teamSuffix(flags: Flags): string {
  return flags.team === undefined ? '' : ` (team ${flags.team})`
}

function roleLabel(role: Role): string {
  return role.teamId === null ? role.name : `${role.name} (team ${String(role.teamId)})`
}

function helpText(command?: string): string {
  const cmd = command === undefined ? undefined : COMMANDS[command.replace(/^permission:/, '')]
  if (cmd) {
    return [`Usage: rbac-evolution ${cmd.usage}`, '', cmd.description].join('\n')
  }
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length))
  return [
    `rbac-evolution ${VERSION} — manage roles & permissions (like \`php artisan permission:*\`)`,
    '',
    'Usage: rbac-evolution <command> [options]',
    '',
    'Commands:',
    ...Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(width)}  ${c.description}`),
    '',
    'Options:',
    '  -c, --config <file>   Config file (default: rbac.config.{ts,js,mjs,...})',
    '  -g, --guard <name>    Guard name (default: the config\'s defaultGuard)',
    '  -t, --team <id>       Team id (when teams are enabled)',
    '      --type <type>     Subject type for assign-role / give-permission (default: user)',
    '      --json            JSON output (show, sync)',
    '  -f, --file <file>     Seed file for sync (.json, .ts, .js; default: `seed` in the config)',
    '      --prune           sync: delete roles & permissions not in the seed (needs --yes)',
    '  -y, --yes             sync --prune: confirm the deletions',
    '      --dry-run         sync: print the plan without writing anything',
    '  -h, --help            Show help',
    '  -v, --version         Show version',
    '',
    'Run `rbac-evolution help <command>` for details.',
  ].join('\n')
}

const CONFIG_TEMPLATE = `import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'

// Use the same adapter and options as your app, for example with Prisma:
//
// import { PrismaClient } from '@prisma/client'
// import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
// const prisma = new PrismaClient()
// const rbac = () => createRbac({ adapter: new PrismaAdapter(prisma) })

export default defineConfig({
  rbac: () => createRbac({ adapter: new MemoryAdapter() }),
  // subjectType: 'user',
  // seed: { permissions: ['edit articles'], roles: { admin: '*', writer: ['edit articles'] } }, // for \`rbac-evolution sync\`
  // teardown: () => prisma.$disconnect(),
})
`

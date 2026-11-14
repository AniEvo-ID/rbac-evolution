import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { Id, Rbac, Role, ScopeOptions, TeamId } from '@anievo-id/rbac-evolution'
import { loadConfig, resolveRbac, type RbacCliConfig } from './config'
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

function parseId(value: string): Id {
  return /^\d+$/.test(value) ? Number(value) : value
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
    '      --json            JSON output (show)',
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
  // teardown: () => prisma.$disconnect(),
})
`

#!/usr/bin/env node
// Checks that every published package resolves correctly for its consumers:
//
// - publint: the `exports`, `main`, `module` and `types` fields point at files that exist and match their format
// - attw (@arethetypeswrong/cli): the types resolve, and match the JavaScript, under node16 (CJS and ESM) and bundlers
//
//   pnpm build && pnpm lint:packages             # every package
//   pnpm lint:packages core nuxt                 # only these (directory names under packages/)
//
// `moduleResolution: node10` is not checked: it ignores `exports`, so subpath entry points
// (`/testing`, `/pg`, `/middleware`, ...) can't resolve there. The main entry points still do.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bin = (name) => join(root, 'node_modules', '.bin', name)

/** Per-package attw options. Keep each exception explained. */
const ATTW = {
  default: ['--profile', 'node16'],
  // A Nuxt module is ESM only (Nuxt loads it with import()), so CommonJS `require` is not supported.
  nuxt: ['--profile', 'esm-only'],
  // ESM only too (`svelte-package` emits ESM; SvelteKit apps are ESM). The main entry point imports `.svelte`
  // components, which only a bundler with the Svelte plugin can load, but its types don't: they declare `Can` and
  // `HasRole` as `Component<CanProps>` / `Component<HasRoleProps>`, so they resolve under node16 and bundler.
  sveltekit: ['--profile', 'esm-only'],
  // The `/sql/*.sql` entry points are plain SQL files for migrations, not modules.
  drizzle: [
    '--profile',
    'node16',
    '--exclude-entrypoints',
    'sql/pg.sql',
    'sql/sqlite.sql',
    'sql/mysql.sql',
    'sql/pg-expiry.sql',
    'sql/sqlite-expiry.sql',
    'sql/mysql-expiry.sql',
  ],
}

const only = process.argv.slice(2)
const dirs = readdirSync(join(root, 'packages'))
  .filter((dir) => existsSync(join(root, 'packages', dir, 'package.json')))
  .filter((dir) => only.length === 0 || only.includes(dir))
  .sort()

const unknown = only.filter((dir) => !dirs.includes(dir))
if (unknown.length > 0) {
  console.error(`Unknown package directories: ${unknown.join(', ')}`)
  process.exit(2)
}

const failures = []
for (const dir of dirs) {
  const cwd = join(root, 'packages', dir)
  if (!existsSync(join(cwd, 'dist'))) {
    console.error(`packages/${dir} has no dist/. Run \`pnpm build\` first.`)
    process.exit(2)
  }
  for (const [tool, args] of [
    ['publint', ['--strict']],
    ['attw', ['--pack', '.', '--format', 'ascii', ...(ATTW[dir] ?? ATTW.default)]],
  ]) {
    console.log(`\n── ${tool} · packages/${dir}`)
    const { status } = spawnSync(bin(tool), args, { cwd, stdio: 'inherit' })
    if (status !== 0) failures.push(`${tool} · packages/${dir}`)
  }
}

if (failures.length > 0) {
  console.error(`\nFailed:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
  process.exit(1)
}
console.log(`\nAll ${dirs.length} packages passed publint and attw.`)

#!/usr/bin/env node
// Runs every package's vitest suite with coverage and writes one summary for the docs
// "Test report" page: docs/public/reports/unit.json.
//
// Usage (repo root, after `pnpm build`): node scripts/test-report.mjs [--out=<file>] [--floor=<file>]
// Set PG_URL / MYSQL_URL / MONGO_URL / MSSQL_URL to include the real-database adapter suites.
//
// --out=<file>    write the report there instead of docs/public/reports/unit.json
// --floor=<file>  also fail when a package's coverage drops below its floor in that JSON file
//                 (`{ "<package name>": { "lines": 90, "branches": 80, ... } }`). A package without
//                 an entry only prints its numbers, so a new package can be added to the file later.
//                 Raise a floor when coverage goes up; never lower one.
//
// Exits 1 when any suite failed or a floor was missed, after the report has been written.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'

const root = process.cwd()
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const tmp = join(root, '.test-report')
const outFile = arg('out') ? resolve(root, arg('out')) : join(root, 'docs/public/reports/unit.json')
const out = dirname(outFile)
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
mkdirSync(out, { recursive: true })

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null)
const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim()

const packages = []
for (const dir of readdirSync(join(root, 'packages')).sort()) {
  const cwd = join(root, 'packages', dir)
  const pkg = readJson(join(cwd, 'package.json'))
  if (!pkg?.scripts?.test) continue

  // Run the package's own setup steps first (e.g. prisma's `node test/prepare.mjs && vitest run`).
  const setup = pkg.scripts.test.split('&&').map((s) => s.trim()).filter((s) => !s.startsWith('vitest'))
  // Like `pnpm run`, put the package's (and the root's) node_modules/.bin on PATH for those steps.
  const PATH = [join(cwd, 'node_modules/.bin'), join(root, 'node_modules/.bin'), process.env.PATH].join(delimiter)
  const setupOk = setup.every((cmd) => spawnSync(cmd, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, PATH } }).status === 0)

  const results = join(tmp, `${dir}.json`)
  const coverageDir = join(tmp, `${dir}-coverage`)
  const started = Date.now()
  const run = spawnSync(
    'pnpm',
    [
      'exec', 'vitest', 'run', '--passWithNoTests',
      '--reporter=default', '--reporter=json', `--outputFile.json=${results}`,
      '--coverage.enabled', '--coverage.provider=v8', '--coverage.reporter=json-summary',
      `--coverage.reportsDirectory=${coverageDir}`, '--coverage.include=src/**',
    ],
    { cwd, stdio: 'inherit', env: process.env },
  )

  const json = readJson(results)
  const total = readJson(join(coverageDir, 'coverage-summary.json'))?.total
  const pct = (k) => (total ? total[k].pct : null)
  packages.push({
    name: pkg.name,
    version: pkg.version,
    ok: setupOk && run.status === 0,
    tests: {
      total: json?.numTotalTests ?? 0,
      passed: json?.numPassedTests ?? 0,
      failed: json?.numFailedTests ?? 0,
      skipped: (json?.numPendingTests ?? 0) + (json?.numTodoTests ?? 0),
    },
    files: json?.numTotalTestSuites ?? 0,
    durationMs: Date.now() - started,
    coverage: { lines: pct('lines'), branches: pct('branches'), functions: pct('functions'), statements: pct('statements') },
  })
}

const sum = (k) => packages.reduce((n, p) => n + p.tests[k], 0)
const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_SHA: sha } = process.env
const report = {
  generatedAt: new Date().toISOString(),
  commit: sha ?? git(['rev-parse', 'HEAD']),
  runUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null,
  databases: { postgres: Boolean(process.env.PG_URL), mysql: Boolean(process.env.MYSQL_URL), mongodb: Boolean(process.env.MONGO_URL) },
  totals: { total: sum('total'), passed: sum('passed'), failed: sum('failed'), skipped: sum('skipped') },
  ok: packages.every((p) => p.ok),
  packages,
}
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
rmSync(tmp, { recursive: true, force: true })
console.log(`\nTest report: ${report.totals.passed}/${report.totals.total} passed, ${report.totals.failed} failed → ${outFile}`)

// ------------------------------------------------------------------------------ coverage floor
let floorOk = true
if (arg('floor')) {
  const floors = readJson(resolve(root, arg('floor'))) ?? {}
  const METRICS = ['lines', 'branches', 'functions', 'statements']
  console.log('\nCoverage (floor in brackets):')
  for (const p of packages) {
    const floor = floors[p.name]
    const cells = METRICS.map((m) => {
      const value = p.coverage[m]
      const min = floor?.[m]
      const below = min !== undefined && (value === null || value < min)
      if (below) floorOk = false
      return `${m} ${value ?? '-'}%${min === undefined ? '' : ` [${min}]`}${below ? ' ✗' : ''}`
    })
    console.log(`  ${p.name.padEnd(36)} ${cells.join('  ')}${floor ? '' : '  (no floor yet)'}`)
  }
  if (!floorOk) console.error('\nCoverage dropped below the floor in ' + arg('floor') + '. Add tests, or explain in the PR.')
}
process.exit(report.ok && floorOk ? 0 : 1)

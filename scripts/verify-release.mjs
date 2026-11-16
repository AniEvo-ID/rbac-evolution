#!/usr/bin/env node
// Checks that every published package is in sync between the repo, npm and GitHub:
//   - npm has the version from package.json, with a provenance attestation
//   - npm's `latest` dist-tag points at that version (for a prerelease such as `1.0.0-rc.0`, the dist-tag named
//     after it, `rc`, instead: `latest` stays on the last stable release)
//   - the git tag `<name>@<version>` exists on origin
//   - a GitHub Release exists for that tag (skipped when the `gh` CLI is not available)
// Writes docs/public/reports/release.json and exits 1 on any mismatch.
//
// Usage (repo root): node scripts/verify-release.mjs
// VERIFY_RETRIES=90 waits up to ~15 minutes for npm to show a fresh publish (10 s between tries). npm can take
// several minutes to list one package of a batch: in 1.3.0 the mongoose package showed up 6 minutes after the others.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const retries = Number(process.env.VERIFY_RETRIES ?? 1)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' })
const hasGh = sh('gh', ['--version']).status === 0

// One shared deadline, so a release where every package is missing waits ~5 minutes, not 5 per package.
const deadline = Date.now() + (retries - 1) * 10_000
async function npmVersion(name, version) {
  for (;;) {
    const res = await fetch(`https://registry.npmjs.org/${name}/${version}`)
    if (res.ok) return res.json()
    if (Date.now() >= deadline) return null
    await sleep(10_000)
  }
}

async function npmDistTag(name, tag) {
  const res = await fetch(`https://registry.npmjs.org/-/package/${name}/dist-tags`)
  return res.ok ? ((await res.json())[tag] ?? null) : null
}

/** `latest` for a stable version, the prerelease id for a prerelease (`1.0.0-rc.0` → `rc`). */
const distTagFor = (version) => /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version)?.[1] ?? 'latest'

const packages = readdirSync(join(root, 'packages'))
  .map((dir) => JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')))
  .filter((pkg) => !pkg.private)
  .sort((a, b) => a.name.localeCompare(b.name))

const rows = []
for (const { name, version } of packages) {
  const tag = `${name}@${version}`
  const published = await npmVersion(name, version)
  const distTag = distTagFor(version)
  const latest = await npmDistTag(name, distTag)
  const tagExists = sh('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]).status === 0
  const release = hasGh ? sh('gh', ['release', 'view', tag, '--json', 'tagName']).status === 0 : null
  const row = {
    name,
    version,
    npm: Boolean(published),
    provenance: Boolean(published?.dist?.attestations),
    distTag,
    latest,
    tag: tagExists,
    release,
  }
  row.ok = row.npm && row.provenance && latest === version && row.tag && row.release !== false
  rows.push(row)
}

const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId } = process.env
const report = {
  generatedAt: new Date().toISOString(),
  runUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null,
  ok: rows.every((r) => r.ok),
  packages: rows,
}
const out = join(root, 'docs/public/reports')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'release.json'), `${JSON.stringify(report, null, 2)}\n`)

const mark = (v) => (v === null ? '-' : v ? 'yes' : 'NO')
console.log('package'.padEnd(38), 'version', ' npm', ' prov', ' latest ', ' tag', ' release')
for (const r of rows) {
  console.log(
    r.name.padEnd(38),
    r.version.padEnd(7),
    mark(r.npm).padStart(4),
    mark(r.provenance).padStart(5),
    String(r.latest).padEnd(8),
    mark(r.tag).padStart(4),
    mark(r.release).padStart(8),
    r.ok ? '' : '  <-- out of sync',
  )
}
console.log(report.ok ? '\nAll packages in sync.' : '\nSome packages are out of sync.')
process.exit(report.ok ? 0 : 1)

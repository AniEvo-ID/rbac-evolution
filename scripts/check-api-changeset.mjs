#!/usr/bin/env node
// Fails when a pull request changes the public API snapshot (`etc/*.api.md`) without adding a changeset.
//
//   node scripts/check-api-changeset.mjs origin/main     # compares origin/main...HEAD
//
// Run in CI on pull requests (needs the base branch fetched). Every public API change must be released
// with a changeset, so the changelog and the version bump record it.
import { execFileSync } from 'node:child_process'

const base = process.argv[2]
if (!base) {
  console.error('Usage: node scripts/check-api-changeset.mjs <base-ref>   (e.g. origin/main)')
  process.exit(2)
}

const diff = (...args) =>
  execFileSync('git', ['diff', '--name-only', ...args, `${base}...HEAD`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

const apiChanges = diff().filter((f) => f.startsWith('etc/'))
if (!apiChanges.length) {
  console.log('No API snapshot changes.')
  process.exit(0)
}
// The pull request that introduces the snapshot has nothing to compare against.
try {
  execFileSync('git', ['cat-file', '-e', `${base}:etc`], { stdio: 'ignore' })
} catch {
  console.log(`etc/ does not exist on ${base} yet: the snapshot is new, no changeset needed.`)
  process.exit(0)
}
// New changesets are added at the root of .changeset/, also in pre mode. Changesets 3 moves the ones already
// versioned into a prerelease to .changeset/pre/: those are not new, so they don't count.
const changesets = diff('--diff-filter=A').filter((f) => /^\.changeset\/[^/]+\.md$/.test(f) && f !== '.changeset/README.md')
if (changesets.length) {
  console.log(`API snapshot changed (${apiChanges.join(', ')}); changeset added: ${changesets.join(', ')}.`)
  process.exit(0)
}
console.error(`The public API changed (${apiChanges.join(', ')}) but no changeset was added.`)
console.error('Run `pnpm changeset`, describe the API change, and commit the new .changeset/*.md file.')
process.exit(1)

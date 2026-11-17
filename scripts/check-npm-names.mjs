#!/usr/bin/env node
// Runs before `changeset publish` (see the `release` script in package.json): fails if a public package in
// packages/* has never been published to npm.
//
// npm Trusted Publishing (OIDC, the only way this repo publishes) can only be set up for a package that already
// exists, so the first version of a new package can't come from CI. Without this check, `changeset publish` would
// publish every other package and fail on the new one, leaving npm half on the new version. Failing first keeps
// the release all-or-nothing.
//
// To add a new package: publish a placeholder (version 0.0.0) by hand once, add the GitHub trusted publisher
// (this repo, release.yml) in the package settings on npmjs.com, then merge the release PR.
//
// Usage (repo root): node scripts/check-npm-names.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    try {
      return JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8'))
    } catch {
      return null
    }
  })
  .filter((pkg) => pkg && !pkg.private)

// Only names of this repo's packages go into a registry URL: the name comes from a file, so anything else is refused.
const NAME = /^@anievo-id\/rbac-evolution(?:-[a-z0-9]+)*$/

const missing = []
for (const { name } of packages) {
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`Unexpected package name: ${JSON.stringify(name)}`)
  // `/<name>` (not a version) answers 404 only when the name has never been published.
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  })
  if (res.status === 404) missing.push(name)
  else if (!res.ok) throw new Error(`npm registry answered ${res.status} for ${name}`)
}

if (missing.length) {
  console.error(`Not on npm yet: ${missing.join(', ')}

npm Trusted Publishing can't publish the first version of a package. Before releasing:
  1. Publish a placeholder (version 0.0.0) of each package above by hand, with an npm account that owns the scope.
  2. On npmjs.com, open each package's settings and add a trusted publisher:
     GitHub Actions, AniEvo-ID/rbac-evolution, workflow release.yml.
Then re-run this workflow. Nothing was published.`)
  process.exit(1)
}
console.log(`All ${packages.length} public packages exist on npm.`)

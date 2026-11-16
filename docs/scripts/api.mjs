// Generates the API reference (docs/api/<package-dir>/) from each package's TypeScript sources
// with TypeDoc + typedoc-plugin-markdown + typedoc-vitepress-theme. The output is gitignored and
// rebuilt by the docs `build` script; run it on its own with `pnpm docs:api` from the repo root.
//
// Entry points come from each package's `exports` map (`./dist/x.d.ts` -> `src/x.ts`, falling
// back to the tsup `entry` map), so a new subpath export shows up here without editing this file.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Application, Converter, ReflectionKind } from 'typedoc'
import { MemberRouter } from 'typedoc-plugin-markdown'

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(docsRoot, '..')
const packagesDir = join(repoRoot, 'packages')
const outRoot = join(docsRoot, 'api')

/** Escapes every regular-expression metacharacter, backslash included. */
const escapeRegExp = (text) => text.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&')

/** `./dist/runtime/rule.d.ts` -> `src/runtime/rule.ts` (or the tsup entry it was built from). */
function sourceFor(pkgDir, typesPath) {
  const stem = typesPath.replace(/^\.\/dist\//, '').replace(/\.d\.c?ts$/, '')
  for (const ext of ['.ts', '.tsx']) {
    const file = join(pkgDir, 'src', stem + ext)
    if (existsSync(file)) return file
  }
  const tsup = readFileSync(join(pkgDir, 'tsup.config.ts'), 'utf8')
  const escaped = escapeRegExp(stem)
  const match = tsup.match(new RegExp(`['"]?${escaped}['"]?\\s*:\\s*['"]([^'"]+)['"]`))
  if (match) return join(pkgDir, match[1])
  throw new Error(`No source file for ${typesPath} in ${pkgDir}`)
}

function entryPoints(pkgDir, pkg) {
  const entries = []
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (subpath === './package.json' || typeof target !== 'object') continue
    const types = target.import?.types ?? target.types
    if (!types) continue
    entries.push({ specifier: subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`, file: sourceFor(pkgDir, types) })
  }
  return entries
}

async function generate(dir) {
  const pkgDir = join(packagesDir, dir)
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const entries = entryPoints(pkgDir, pkg)
  const out = join(outRoot, dir)

  const app = await Application.bootstrapWithPlugins({
    name: pkg.name,
    entryPoints: entries.map((e) => e.file),
    tsconfig: join(pkgDir, 'tsconfig.json'),
    plugin: ['typedoc-plugin-markdown', 'typedoc-vitepress-theme'],
    out,
    docsRoot,
    router: 'rbac',
    // The `.` export is the landing page (`/api/<dir>/`); other subpaths get `/api/<dir>/<subpath>/`.
    entryModule: pkg.name,
    readme: 'none',
    excludeInternal: true,
    excludePrivate: true,
    excludeProtected: true,
    excludeExternals: true,
    // The package tsconfigs already typecheck in CI; don't fail the docs on a stray error.
    skipErrorChecking: true,
    // Stable output: source links always point at main, whatever checkout builds the docs.
    disableGit: true,
    displayBasePath: repoRoot,
    sourceLinkTemplate: 'https://github.com/AniEvo-ID/rbac-evolution/blob/main/{path}#L{line}',
    sourceLinkExternal: true,
    hideGenerator: true,
    hidePageHeader: true,
    hideBreadcrumbs: true,
    entryFileName: 'index',
    useCodeBlocks: true,
    parametersFormat: 'table',
    interfacePropertiesFormat: 'table',
    classPropertiesFormat: 'table',
    typeDeclarationFormat: 'table',
    // The theme's sidebar drops the members of `entryModule`; scripts/api.mjs writes its own.
    sidebar: { autoConfiguration: false },
    logLevel: 'Warn',
    validation: { notExported: false, invalidLink: true, rewrittenLink: true },
  })

  // Subpath modules live under their subpath (`testing`, `pg`) rather than `@anievo-id/.../testing`.
  app.renderer.defineRouter(
    'rbac',
    class extends MemberRouter {
      getReflectionAlias(reflection) {
        if (reflection.kindOf(ReflectionKind.Module) && reflection.name === pkg.name) return '.'
        if (reflection.kindOf(ReflectionKind.Module) && reflection.name.startsWith(`${pkg.name}/`)) {
          return reflection.name.slice(pkg.name.length + 1)
        }
        return super.getReflectionAlias(reflection)
      }
    },
  )

  // Name each entry module after its import specifier (`@anievo-id/rbac-evolution/testing`)
  // instead of its file name (`testing`, `middleware-entry`).
  const bySource = new Map(entries.map((e) => [resolve(e.file), e.specifier]))
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (context, reflection) => {
    if (!reflection.kindOf(ReflectionKind.Module)) return
    const id = context.project.getSymbolIdFromReflection(reflection)
    const specifier = id && bySource.get(resolve(id.fileName))
    if (specifier) reflection.name = specifier
  })

  const project = await app.convert()
  if (!project) throw new Error(`TypeDoc failed to convert ${pkg.name}`)
  rmSync(out, { recursive: true, force: true })
  await app.generateOutputs(project)
  linkSubpaths(out, entries)
  console.log(`api: ${pkg.name} -> ${relative(repoRoot, out)} (${entries.length} entry point${entries.length > 1 ? 's' : ''})`)
  return { text: pkg.name, link: `/api/${dir}/`, collapsed: true, items: sidebarItems(out, `/api/${dir}`) }
}

/** The landing page of a package documents its `.` export; list the other subpaths there too. */
function linkSubpaths(out, entries) {
  const subpaths = entries.slice(1)
  if (!subpaths.length) return
  const index = join(out, 'index.md')
  const list = subpaths.map((e) => `- [${e.specifier}](${e.specifier.split('/').pop()}/index.md)`).join('\n')
  const contents = readFileSync(index, 'utf8').replace(/^(# .+\n)/, `$1\n## Entry points\n\n${list}\n`)
  writeFileSync(index, contents)
}

const KINDS = [
  ['classes', 'Classes'],
  ['functions', 'Functions'],
  ['interfaces', 'Interfaces'],
  ['type-aliases', 'Type aliases'],
  ['variables', 'Variables'],
  ['enumerations', 'Enumerations'],
  ['namespaces', 'Namespaces'],
]

/** Sidebar items from the generated tree: one group per kind folder, then one per subpath module. */
function sidebarItems(dir, link) {
  const items = []
  const names = readdirSync(dir).sort()
  for (const [folder, text] of KINDS) {
    if (!names.includes(folder)) continue
    const pages = readdirSync(join(dir, folder))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => ({ text: f.slice(0, -3), link: `${link}/${folder}/${f.slice(0, -3)}` }))
    items.push({ text, collapsed: true, items: pages })
  }
  const kindFolders = new Set(KINDS.map(([folder]) => folder))
  for (const name of names) {
    if (kindFolders.has(name) || !statSync(join(dir, name)).isDirectory()) continue
    items.push({ text: `/${name}`, link: `${link}/${name}/`, collapsed: true, items: sidebarItems(join(dir, name), `${link}/${name}`) })
  }
  return items
}

const only = process.argv.slice(2)
const dirs = readdirSync(packagesDir).filter((d) => existsSync(join(packagesDir, d, 'package.json')))
const sidebar = []
for (const dir of only.length ? dirs.filter((d) => only.includes(d)) : dirs) sidebar.push(await generate(dir))
// core first, the rest alphabetically (by folder)
sidebar.sort((a, b) => (a.link === '/api/core/' ? -1 : b.link === '/api/core/' ? 1 : a.link.localeCompare(b.link)))
writeFileSync(join(outRoot, 'sidebar.json'), `${JSON.stringify(sidebar, null, 2)}\n`)

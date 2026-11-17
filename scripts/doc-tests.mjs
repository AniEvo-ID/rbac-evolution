#!/usr/bin/env node
// Doc tests: type-checks the TypeScript code blocks of the main docs pages against the built packages,
// so the examples can't drift from the real API.
//
//   pnpm build && pnpm doc:test               check every page
//   pnpm doc:test docs/frameworks/hono.md     check one page (or several)
//
// How it works:
// - Every ```ts / ```tsx block of the pages below (code-group tabs included) is written to
//   `.doc-tests/<page>/src/L<line>.ts` as its own module (`export {}` is appended, so blocks never share
//   scope), and each page is type-checked as one program.
// - `.doc-tests/node_modules` links the workspace packages and their installed dependencies, so imports
//   resolve to the same `dist/*.d.ts` files a user gets.
// - Snippets are often fragments that use `rbac`, `user`, `app`, ... without declaring them. Instead of
//   guessing, the free variables are declared with their real types in scripts/doc-tests/:
//     core.d.ts            the core package's exports (`createRbac`, `Subject`, ...), for every page
//     prelude.d.ts         `rbac`, `adapter`, `user`, for pages without a prelude of their own
//     pages/<page>.d.ts    a page's own free variables, instead of prelude.d.ts
//                          (`app` is an Express app on the Express page, a Hono app on the Hono page)
//     modules.d.ts         typed stand-ins for packages the workspace doesn't install (ioredis, next-auth)
//     stubs/_shared/, stubs/<page>/ (and a set of STUB_SETS below)
//                          app modules the snippets import (`./rbac`, `@/lib/prisma`, ...), copied into
//                          `.doc-tests/<page>/` (blocks are in its `src/`, `@/*` maps to its root)
//   <page> is the path under docs/ with dashes: `frameworks-express` for docs/frameworks/express.md.
// - A line commented `// type error` must NOT compile (the docs show a typo the types catch): it gets a
//   `// @ts-expect-error` above it, so the check fails if the types stop catching it.
// - A block that can't type-check on its own (pseudo-code, a partial object, ...) is skipped with an
//   HTML comment on the line right before its fence, which VitePress doesn't render:
//       <!-- doc-test: skip -->
//
// Compiler options: strict, no unused-locals checks, JSX for React, legacy decorators for NestJS, DOM lib
// (a server-only page's prelude can opt out with `// doc-test: no-dom`). Each page also gets a tsconfig,
// so `npx tsc -p .doc-tests/<page>` reproduces its errors with plain tsc after a run.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const here = path.join(root, 'scripts', 'doc-tests')
const out = path.join(root, '.doc-tests')
const started = performance.now()

// ---------------------------------------------------------------------------------------------------
// Pages

const PAGES = [
  'docs/guide/quick-start.md',
  'docs/basic-usage/*.md',
  'docs/advanced/*.md',
  'docs/frameworks/*.md',
  'docs/adapters/*.md',
  'docs/best-practices/*.md',
  'docs/recipes/*.md',
  'docs/use-cases/*.md',
  'docs/guide/coming-from-laravel.md',
  'docs/guide/how-it-works.md',
]

/** Escapes every regular-expression metacharacter, backslash included. */
const escapeRegExp = (text) => text.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&')

function expand(pattern) {
  if (!pattern.includes('*')) return [pattern]
  const dir = path.dirname(pattern)
  const re = new RegExp('^' + path.basename(pattern).split('*').map(escapeRegExp).join('.*') + '$')
  return fs
    .readdirSync(path.join(root, dir))
    .filter((f) => re.test(f))
    .sort()
    .map((f) => `${dir}/${f}`)
}

const only = process.argv.slice(2).map((p) => path.relative(root, path.resolve(p)).split(path.sep).join('/'))
const pages = [...new Set(PAGES.flatMap(expand))].filter((p) => only.length === 0 || only.includes(p))
if (pages.length === 0) {
  console.error(`doc-tests: no page matches ${only.join(', ')}`)
  process.exit(2)
}
if (!fs.existsSync(path.join(root, 'packages/core/dist/index.d.ts'))) {
  console.error('doc-tests: the packages are not built, run `pnpm build` first')
  process.exit(2)
}

// ---------------------------------------------------------------------------------------------------
// Extraction

const SKIP = /^\s*<!--\s*doc-test:\s*skip\s*-->\s*$/
const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)(.*)$/
const EXPECT_ERROR = /\/\/.*\btype error\b/
const LANGS = { ts: 'ts', typescript: 'ts', tsx: 'tsx' }
/** Extra stub directories some pages share: the Next.js app modules (`@/lib/rbac`, `@/auth`, `@/lib/prisma`). */
const STUB_SETS = {
  'frameworks-nextjs': ['_next'],
  'frameworks-react': ['_next'],
  'recipes-authjs': ['_next'],
  'use-cases-saas-multi-tenant': ['_next'],
}

/** Code blocks of a Markdown page: { lang, line (of the opening fence, 1-based), code, skip }. */
function extract(markdown) {
  const lines = markdown.split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE_OPEN.exec(lines[i])
    if (!open) continue
    const [, indent, fence, lang] = open
    const body = []
    let j = i + 1
    for (; j < lines.length; j++) {
      const close = lines[j].trim()
      if (close.startsWith(fence) && /^[`~]+$/.test(close)) break
      body.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j].trimStart())
    }
    let prev = i - 1
    while (prev >= 0 && lines[prev].trim() === '') prev--
    blocks.push({ lang: lang.toLowerCase(), line: i + 1, code: body, skip: prev >= 0 && SKIP.test(lines[prev]) })
    i = j
  }
  return blocks
}

// ---------------------------------------------------------------------------------------------------
// Workspace: .doc-tests/node_modules and one directory per page

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

/** Links the workspace packages and every dependency they have installed into .doc-tests/node_modules. */
function linkModules() {
  const nm = path.join(out, 'node_modules')
  const link = (name, target) => {
    const at = path.join(nm, name)
    if (fs.existsSync(at)) return
    fs.mkdirSync(path.dirname(at), { recursive: true })
    // A junction needs no admin rights on Windows; other platforms ignore the type.
    fs.symlinkSync(fs.realpathSync(target), at, 'junction')
  }
  const pkgDirs = fs
    .readdirSync(path.join(root, 'packages'))
    .map((d) => path.join(root, 'packages', d))
    .filter((d) => fs.existsSync(path.join(d, 'package.json')))
  for (const dir of pkgDirs) link(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name, dir)
  for (const dir of [...pkgDirs, root]) {
    const deps = path.join(dir, 'node_modules')
    if (!fs.existsSync(deps)) continue
    for (const entry of fs.readdirSync(deps)) {
      if (entry.startsWith('.')) continue
      if (!entry.startsWith('@')) link(entry, path.join(deps, entry))
      else for (const sub of fs.readdirSync(path.join(deps, entry))) link(`${entry}/${sub}`, path.join(deps, entry, sub))
    }
  }
}
linkModules()

const origins = new Map() // file in .doc-tests -> its source, for error messages
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  origins.set(to, from)
}
/** Copies a directory, returns the files copied. */
function copyTree(from, to) {
  if (!fs.existsSync(from)) return []
  return fs.readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return copyTree(path.join(from, entry.name), path.join(to, entry.name))
    copy(path.join(from, entry.name), path.join(to, entry.name))
    return [path.join(to, entry.name)]
  })
}

const slug = (page) => page.replace(/^docs\//, '').replace(/\.md$/, '').replace(/\//g, '-')

const options = {
  target: 'ES2022',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  jsx: 'react-jsx',
  strict: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  esModuleInterop: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  noEmit: true,
  types: ['node'],
  paths: { '@/*': ['./*'] },
}

const blockFiles = new Map() // block file -> { page, lines }
const configs = []
let checked = 0
let skipped = 0
for (const page of pages) {
  const dir = path.join(out, slug(page))
  const blocks = extract(fs.readFileSync(path.join(root, page), 'utf8'))
  const files = []
  for (const block of blocks) {
    const ext = LANGS[block.lang]
    if (!ext) continue
    if (block.skip) {
      skipped++
      continue
    }
    checked++
    // `lines[i]` is the page line of line i (0-based) of the generated file.
    const code = []
    const lines = []
    block.code.forEach((text, i) => {
      if (EXPECT_ERROR.test(text)) {
        code.push('// @ts-expect-error doc-test: the docs say the next line is a type error')
        lines.push(block.line + i + 1)
      }
      code.push(text)
      lines.push(block.line + i + 1)
    })
    const file = path.join(dir, 'src', `L${block.line}.${ext}`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${code.join('\n')}\nexport {}\n`)
    blockFiles.set(file, { page, lines })
    files.push(file)
  }
  if (files.length === 0) continue

  // Preludes are copied as `.ts` (not `.d.ts`), so skipLibCheck doesn't hide their own errors, and into
  // .doc-tests, so their `import('...')` types resolve through .doc-tests/node_modules.
  const own = path.join(here, 'pages', `${slug(page)}.d.ts`)
  const preludes = [path.join(here, 'core.d.ts'), path.join(here, 'modules.d.ts'), fs.existsSync(own) ? own : path.join(here, 'prelude.d.ts')]
  const support = preludes.map((from) => {
    const to = path.join(dir, '_prelude', path.basename(from).replace(/\.d\.ts$/, '.ts'))
    copy(from, to)
    return to
  })
  // Stubs are all part of the program (a module augmentation, e.g. `request.user`, is a stub too).
  for (const set of ['_shared', ...(STUB_SETS[slug(page)] ?? []), slug(page)]) {
    support.push(...copyTree(path.join(here, 'stubs', set), dir))
  }

  // A tsconfig per page, so a failure can be reproduced with `npx tsc -p .doc-tests/<page>`.
  const config = path.join(dir, 'tsconfig.json')
  const rel = (f) => './' + path.relative(dir, f).split(path.sep).join('/')
  // A server-only page can drop the DOM lib (`// doc-test: no-dom` in its prelude), e.g. so that `event`
  // can be declared as an h3 event instead of clashing with the DOM's global `event`.
  const noDom = fs.existsSync(own) && /\/\/ doc-test: no-dom\b/.test(fs.readFileSync(own, 'utf8'))
  const compilerOptions = noDom ? { ...options, lib: ['ES2022'] } : options
  fs.writeFileSync(config, JSON.stringify({ compilerOptions, files: [...support, ...files].map(rel) }, null, 2) + '\n')
  configs.push(config)
}

// ---------------------------------------------------------------------------------------------------
// Type-check: one program per page. Parsed declaration files (lib, node_modules) are shared between the
// programs, which keeps the whole run to a few seconds.

const cache = new Map()
const baseHost = ts.createCompilerHost({})
const host = {
  ...baseHost,
  getSourceFile(fileName, languageVersion, onError, shouldCreate) {
    const shared = fileName.includes(`${path.sep}node_modules${path.sep}`) || !fileName.startsWith(out + path.sep)
    if (shared && cache.has(fileName)) return cache.get(fileName)
    const sf = baseHost.getSourceFile(fileName, languageVersion, onError, shouldCreate)
    if (shared && sf) cache.set(fileName, sf)
    return sf
  },
}

const diagnostics = []
for (const config of configs) {
  const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => diagnostics.push(d) })
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host })
  diagnostics.push(...parsed.errors, ...ts.getPreEmitDiagnostics(program))
}

// ---------------------------------------------------------------------------------------------------
// Report, with page lines

const failures = new Map() // page or support file -> messages
for (const d of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n      ')
  let group = '(compiler)'
  let where = ''
  if (d.file) {
    const fileName = path.normalize(d.file.fileName)
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0)
    const block = blockFiles.get(fileName)
    if (block) {
      group = block.page
      where = `${block.page}:${block.lines[line] ?? block.lines.at(-1)}:${character + 1}`
    } else {
      group = path.relative(root, origins.get(fileName) ?? fileName)
      where = `${group}:${line + 1}:${character + 1} (${path.relative(root, fileName)})`
    }
  }
  if (!failures.has(group)) failures.set(group, [])
  failures.get(group).push(`  ${where}  TS${d.code}: ${message}`)
}
for (const [group, messages] of failures) {
  console.error(`\n${group}`)
  for (const m of messages) console.error(m)
}

const seconds = ((performance.now() - started) / 1000).toFixed(1)
const summary = `${checked} blocks type-checked, ${skipped} skipped, ${configs.length} pages, ${seconds}s`
if (diagnostics.length > 0) {
  console.error(`\ndoc-tests: ${diagnostics.length} error(s). ${summary}`)
  console.error('Fix the docs. For a fragment, declare its free variables in scripts/doc-tests/ (see the top of')
  console.error('scripts/doc-tests.mjs); for a block that can never compile on its own, put `<!-- doc-test: skip -->`')
  console.error('on the line before its fence.')
  process.exit(1)
}
console.log(`doc-tests: ok. ${summary}`)

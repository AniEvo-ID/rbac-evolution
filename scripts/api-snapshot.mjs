#!/usr/bin/env node
// Writes a snapshot of every package's public API to `etc/<package-dir>.api.md`, read from the built `.d.ts` files.
//
//   pnpm build && pnpm api:snapshot     # node scripts/api-snapshot.mjs          — (re)writes etc/*.api.md
//   pnpm api:check                      # node scripts/api-snapshot.mjs --check  — exits 1 when a file would change
//
// For each `exports` entry with types, every exported name is listed with its kind and its declaration as
// TypeScript prints it (JSDoc removed, `private` / `#private` class members dropped). Declarations the
// entry does not export but its API refers to ("unexported references") are listed too, so a change to
// them shows up as well. Names re-exported from another package are listed by module only (that
// package's own snapshot covers them). Commit the files: CI fails when they are stale, and a pull request
// that changes them needs a changeset.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'packages/core/package.json'))
const ts = require('typescript')

const check = process.argv.includes('--check')
const outDir = join(root, 'etc')

/** Finds the `types` file of an `exports` entry, preferring the ESM condition. */
function typesOf(entry) {
  if (typeof entry === 'string') return entry.endsWith('.d.ts') ? entry : null
  if (!entry || typeof entry !== 'object') return null
  if (typeof entry.types === 'string') return entry.types
  for (const key of ['import', 'default', 'require']) {
    const found = typesOf(entry[key])
    if (found) return found
  }
  return null
}

const resolveAlias = (symbol, checker) => (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)

function kindOf(target) {
  const f = target.flags
  const kinds = []
  if (f & ts.SymbolFlags.Class) kinds.push('class')
  else if (f & ts.SymbolFlags.Function) kinds.push('function')
  else if (f & ts.SymbolFlags.Enum) kinds.push('enum')
  else if (f & ts.SymbolFlags.Variable) kinds.push('const')
  if (f & ts.SymbolFlags.Interface && !(f & ts.SymbolFlags.Class)) kinds.push('interface')
  if (f & ts.SymbolFlags.TypeAlias) kinds.push('type')
  if (f & (ts.SymbolFlags.NamespaceModule | ts.SymbolFlags.ValueModule) && !kinds.length) kinds.push('namespace')
  return kinds.length ? kinds.join(' + ') : 'other'
}

/** Name of the package (or relative module) a file belongs to, e.g. `@anievo-id/rbac-evolution`, `react`. */
const packageNameCache = new Map()
function owningPackage(file) {
  let dir = dirname(file)
  while (dir !== dirname(dir)) {
    if (packageNameCache.has(dir)) return packageNameCache.get(dir)
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const { name } = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (name) {
        packageNameCache.set(dir, { name, dir })
        return { name, dir }
      }
    }
    dir = dirname(dir)
  }
  return { name: '(unknown)', dir: '/' }
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

const isPrivateMember = (member) =>
  (member.name && ts.isPrivateIdentifier(member.name)) ||
  (ts.canHaveModifiers(member) && (ts.getModifiers(member) ?? []).some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))

/** Removes `private` and `#private` members from a class declaration before printing it. */
function publicShape(node) {
  if (ts.isClassDeclaration(node)) {
    return ts.factory.updateClassDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members.filter((m) => !isPrivateMember(m)),
    )
  }
  return node
}

/** Drops `export` / `default` so a declaration prints the same whether it is exported inline or in an `export { }` list. */
function withoutExportModifier(node) {
  if (!ts.canHaveModifiers(node)) return node
  const modifiers = ts.getModifiers(node)
  if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword)) return node
  const kept = modifiers.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword && m.kind !== ts.SyntaxKind.DefaultKeyword)
  if (!kept.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) && !ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) {
    kept.unshift(ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword))
  }
  return ts.factory.replaceModifiers(node, kept)
}

function printDeclaration(decl, checker) {
  const sourceFile = decl.getSourceFile()
  if (ts.isVariableDeclaration(decl)) {
    // Print `declare const x: T;` for this one variable, even when the statement declares several.
    const flags = decl.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)
    const typeText = decl.type
      ? printer.printNode(ts.EmitHint.Unspecified, decl.type, sourceFile)
      : stripImportPaths(checker.typeToString(checker.getTypeAtLocation(decl), decl, ts.TypeFormatFlags.NoTruncation))
    const keyword = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var'
    return `declare ${keyword} ${decl.name.getText(sourceFile)}: ${typeText};`
  }
  if (ts.isExportAssignment(decl)) return printer.printNode(ts.EmitHint.Unspecified, decl, sourceFile)
  return printer.printNode(ts.EmitHint.Unspecified, withoutExportModifier(publicShape(decl)), sourceFile)
}

/** `import("./chunk-AB12CD").Foo` → `Foo`: chunk file names carry build hashes. Package imports are kept. */
const stripImportPaths = (text) => text.replace(/import\("\.{1,2}\/[^"]*"\)\./g, '')

/** JSDoc tags worth flagging in the snapshot. */
function flagTags(symbol, checker) {
  const names = new Set(symbol.getJsDocTags(checker).map((t) => t.name))
  return ['deprecated', 'internal', 'experimental', 'beta'].filter((n) => names.has(n)).map((n) => `@${n}`)
}

/** Every symbol a declaration refers to by name in a type position (or `typeof x`). */
function referencedSymbols(decl, checker) {
  const out = []
  const visit = (node) => {
    let id
    if (ts.isTypeReferenceNode(node)) id = node.typeName
    else if (ts.isExpressionWithTypeArguments(node)) id = node.expression
    else if (ts.isTypeQueryNode(node)) id = node.exprName
    if (id) {
      // `ns.Foo` → resolve the whole name; for a namespace import that leads outside the package anyway.
      const symbol = checker.getSymbolAtLocation(ts.isQualifiedName(id) ? id.right : ts.isPropertyAccessExpression(id) ? id.name : id)
      if (symbol) out.push(symbol)
    }
    // Skip private class members: they are not printed.
    if ((ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) && isPrivateMember(node)) return
    ts.forEachChild(node, visit)
  }
  visit(decl)
  return out
}

/** Stable identity of a declaration across programs (each entry point gets its own program). */
const declKey = (decl) => `${realpathSync(decl.getSourceFile().fileName)}:${decl.pos}`

/** `true` inside `declare module 'x' { }` / `declare global { }` (printed under "Module augmentations"). */
function inAugmentation(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isModuleDeclaration(n) && (ts.isStringLiteral(n.name) || n.flags & ts.NodeFlags.GlobalAugmentation)) return true
  }
  return false
}

function analyzeEntry(pkgDir, specifier, file) {
  const program = ts.createProgram([file], { skipLibCheck: true, noEmit: true, allowJs: false, strict: true })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  const moduleSymbol = checker.getSymbolAtLocation(source)
  const exportSymbols = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []
  const realPkgDir = realpathSync(pkgDir) + sep
  const isLocal = (decl) => {
    const f = decl.getSourceFile().fileName
    return (existsSync(f) ? realpathSync(f) : f).startsWith(realPkgDir)
  }

  const exported = new Map() // target symbol -> exported name
  for (const symbol of exportSymbols) exported.set(resolveAlias(symbol, checker), symbol.name)

  const blocks = []
  const exportedKeys = new Set()
  const reexports = new Map() // module -> names
  const pending = [] // local symbols to check for unexported references
  for (const symbol of [...exportSymbols].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const target = resolveAlias(symbol, checker)
    const decls = target.declarations ?? []
    const local = decls.filter(isLocal)
    if (!local.length) {
      const from = decls[0] ? owningPackage(realpathSync(decls[0].getSourceFile().fileName)).name : '(unresolved)'
      const names = reexports.get(from) ?? []
      names.push(`${symbol.name} (${kindOf(target)})`)
      reexports.set(from, names)
      continue
    }
    const tags = flagTags(target, checker)
    const head = [`// ${symbol.name}: ${kindOf(target)}`]
    if (target.name !== symbol.name && symbol.name !== 'default') head[0] += ` (declared as ${target.name})`
    if (tags.length) head[0] += ` ${tags.join(' ')}`
    for (const d of local) exportedKeys.add(declKey(d))
    blocks.push([...head, ...local.map((d) => printDeclaration(d, checker))].join('\n'))
    pending.push(...local)
  }

  // Unexported declarations the public API refers to, found transitively.
  const seen = new Set(exported.keys())
  const unexported = []
  while (pending.length) {
    const decl = pending.shift()
    for (const ref of referencedSymbols(decl, checker)) {
      const target = resolveAlias(ref, checker)
      if (seen.has(target)) continue
      seen.add(target)
      if (target.flags & ts.SymbolFlags.TypeParameter) continue
      const local = (target.declarations ?? []).filter(
        (d) =>
          isLocal(d) && !inAugmentation(d) && !ts.isTypeParameterDeclaration(d) && !ts.isParameter(d) && !ts.isNamespaceImport(d),
      )
      if (!local.length) continue
      unexported.push({
        name: target.name,
        keys: local.map(declKey),
        kind: kindOf(target),
        text: [`// ${target.name}: ${kindOf(target)} (not exported)`, ...local.map((d) => printDeclaration(d, checker))].join('\n'),
      })
      pending.push(...local)
    }
  }
  unexported.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.text < b.text ? -1 : 1))

  // `declare module '…'` / `declare global` augmentations in the package's own files.
  const augmentations = []
  for (const sf of program.getSourceFiles()) {
    if (!isLocal(sf)) continue
    for (const statement of sf.statements) {
      if (ts.isModuleDeclaration(statement) && (ts.isStringLiteral(statement.name) || statement.flags & ts.NodeFlags.GlobalAugmentation)) {
        augmentations.push(printer.printNode(ts.EmitHint.Unspecified, statement, sf))
      }
    }
  }
  augmentations.sort()

  return { specifier, exportCount: exportSymbols.length, blocks, exportedKeys, reexports, unexported, augmentations }
}

/** Renders one entry point. `elsewhere` maps declaration keys exported by the package's other entries to their specifier. */
function renderEntry({ specifier, exportCount, blocks, reexports, unexported, augmentations }, elsewhere) {
  const lines = [`## \`${specifier}\``, '']
  lines.push(`${exportCount} export${exportCount === 1 ? '' : 's'}.`, '')
  if (blocks.length) lines.push('```ts', blocks.join('\n\n'), '```', '')
  if (reexports.size) {
    lines.push('Re-exported from other packages:', '')
    for (const [from, names] of [...reexports].sort(([a], [b]) => (a < b ? -1 : 1))) {
      lines.push(`- \`${from}\`: ${names.map((n) => `\`${n.replace(/ \(/, '` (')}`).join(', ')}`)
    }
    lines.push('')
  }
  const fromSiblings = new Map() // specifier -> names
  const own = []
  for (const u of unexported) {
    const other = u.keys.map((k) => elsewhere.get(k)).find(Boolean)
    if (!other) {
      own.push(u)
      continue
    }
    const names = fromSiblings.get(other) ?? []
    names.push(`\`${u.name}\` (${u.kind})`)
    fromSiblings.set(other, names)
  }
  if (fromSiblings.size) {
    lines.push('Referenced from other entry points of this package (not re-exported here):', '')
    for (const [other, names] of [...fromSiblings].sort(([a], [b]) => (a < b ? -1 : 1))) lines.push(`- \`${other}\`: ${names.join(', ')}`)
    lines.push('')
  }
  unexported = own
  if (unexported.length) {
    lines.push('Unexported declarations referenced by the API:', '', '```ts', unexported.map((u) => u.text).join('\n\n'), '```', '')
  }
  if (augmentations.length) lines.push('Module augmentations:', '', '```ts', augmentations.join('\n\n'), '```', '')
  return lines.join('\n')
}

function snapshotPackage(dir) {
  const pkgDir = join(root, 'packages', dir)
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const sections = []
  for (const [subpath, entry] of Object.entries(pkg.exports ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (subpath === './package.json') continue
    const types = typesOf(entry)
    const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`
    if (!types) {
      sections.push(`## \`${specifier}\`\n\nNo types (\`${typeof entry === 'string' ? entry : JSON.stringify(entry)}\`).\n`)
      continue
    }
    const file = join(pkgDir, types)
    if (!existsSync(file)) {
      console.error(`Missing ${relative(root, file)}. Run \`pnpm build\` first.`)
      process.exit(1)
    }
    sections.push(analyzeEntry(pkgDir, specifier, file))
  }
  const rendered = sections.map((section) => {
    if (typeof section === 'string') return section
    const elsewhere = new Map()
    for (const other of sections) {
      if (typeof other === 'string' || other === section) continue
      for (const k of other.exportedKeys) if (!elsewhere.has(k)) elsewhere.set(k, other.specifier)
    }
    return renderEntry(section, elsewhere)
  })
  const header = [
    `# API snapshot: \`${pkg.name}\``,
    '',
    '<!-- Generated by scripts/api-snapshot.mjs from the built .d.ts files. Do not edit: run `pnpm build && pnpm api:snapshot`. -->',
    '',
    '',
  ]
  return header.join('\n') + rendered.join('\n').replace(/\n+$/, '') + '\n'
}

const dirs = readdirSync(join(root, 'packages'))
  .filter((d) => existsSync(join(root, 'packages', d, 'package.json')))
  .sort()

/** The file's text, or `null` when it doesn't exist (read directly, so nothing can change between a check and the read). */
function readIfExists(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

const changed = []
if (!check) mkdirSync(outDir, { recursive: true })
for (const dir of dirs) {
  const target = join(outDir, `${dir}.api.md`)
  const next = snapshotPackage(dir)
  const current = readIfExists(target)
  if (current === next) continue
  changed.push({ file: relative(root, target), current, next })
  if (!check) writeFileSync(target, next)
}
const expected = new Set(dirs.map((d) => `${d}.api.md`))
const stale = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.api.md') && !expected.has(f)) : []

/** Lines only in `a` / only in `b` (multiset difference): enough to see what changed. */
function lineDiff(a, b) {
  const count = new Map()
  for (const l of a) count.set(l, (count.get(l) ?? 0) + 1)
  const added = []
  for (const l of b) {
    const n = count.get(l) ?? 0
    if (n > 0) count.set(l, n - 1)
    else added.push(l)
  }
  const removed = []
  for (const [l, n] of count) for (let i = 0; i < n; i++) removed.push(l)
  return { added, removed }
}

if (check) {
  if (!changed.length && !stale.length) {
    console.log(`API snapshots are up to date (${dirs.length} packages).`)
    process.exit(0)
  }
  console.error('The public API differs from the committed snapshot in etc/:\n')
  for (const { file, current, next } of changed) {
    if (current === null) {
      console.error(`  ${file}: missing`)
      continue
    }
    const { added, removed } = lineDiff(current.split('\n'), next.split('\n'))
    console.error(`  ${file}: ${added.length} line(s) added, ${removed.length} removed`)
    const MAX = 40
    for (const l of removed.slice(0, MAX)) console.error(`    - ${l}`)
    for (const l of added.slice(0, MAX)) console.error(`    + ${l}`)
    if (added.length > MAX || removed.length > MAX) console.error('    …')
  }
  for (const f of stale) console.error(`  etc/${f}: no such package any more (delete it)`)
  console.error('\nIf the change is intended, run `pnpm build && pnpm api:snapshot`, commit etc/, and add a changeset (`pnpm changeset`).')
  process.exit(1)
}

for (const f of stale) console.warn(`etc/${f} has no package; delete it.`)
console.log(changed.length ? `Updated ${changed.map((c) => c.file).join(', ')}` : `API snapshots are up to date (${dirs.length} packages).`)

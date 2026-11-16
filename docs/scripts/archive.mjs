#!/usr/bin/env node
// Builds the frozen 0.x docs into docs/.vitepress/dist/0.x/, served at https://creation.anievo.id/rbac-evolution/0.x/.
// Run after `pnpm --filter @anievo-id/rbac-evolution-docs build` (the Docs workflow does), from the repo root:
//
//   node docs/scripts/archive.mjs
//
// The 0.x site is built from the last 0.x release tag, with that tag's own docs, config and dependencies, so it never
// changes. A small wrapper config only moves it under /0.x/, marks it as archived (banner, nav link to the latest
// docs, noindex) and drops the "Edit this page" links. Needs the tag in the clone (`fetch-depth: 0`).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Last 0.x release: the archive. Change it only to fix the archive itself. */
export const ARCHIVE_TAG = '@anievo-id/rbac-evolution@0.9.0'
export const ARCHIVE_PATH = '0.x'
const SITE = 'https://creation.anievo.id/rbac-evolution/'

const root = join(import.meta.dirname, '../..')
const dist = join(root, 'docs/.vitepress/dist')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

if (!existsSync(dist)) {
  console.error('docs/.vitepress/dist is missing: build the current docs first.')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'rbac-docs-0x-'))
run('git', ['worktree', 'add', '--detach', work, ARCHIVE_TAG], root)
try {
  const vp = join(work, 'docs/.vitepress')
  renameSync(join(vp, 'config.ts'), join(vp, 'config.frozen.ts'))
  writeFileSync(
    join(vp, 'config.ts'),
    `// Written by docs/scripts/archive.mjs (main branch): the ${ARCHIVE_TAG} docs config, moved under /${ARCHIVE_PATH}/.
import type { DefaultTheme, HeadConfig, UserConfig } from 'vitepress'
import frozen from './config.frozen'

const config = frozen as UserConfig<DefaultTheme.Config>
const theme = config.themeConfig ?? {}
const banner = ${JSON.stringify(
      `You are reading the archived 0.x docs. <a href="${SITE}">Go to the latest docs</a> and the <a href="${SITE}guide/upgrading">upgrade guide</a>.`,
    )}
const head: HeadConfig[] = [
  ...(config.head ?? []),
  ['meta', { name: 'robots', content: 'noindex' }],
  ['link', { rel: 'canonical', href: ${JSON.stringify(SITE)} }],
  ['style', {}, '#archive-banner{position:fixed;z-index:100;bottom:0;left:0;right:0;padding:8px 16px;text-align:center;font-size:14px;background:#5c2d00;color:#fff}#archive-banner a{color:#ffd28a;text-decoration:underline}body{padding-bottom:40px}'],
  ['script', {}, \`document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='archive-banner';b.setAttribute('role','note');b.innerHTML=\${JSON.stringify(banner)};document.body.appendChild(b)})\`],
]

export default {
  ...config,
  base: '/rbac-evolution/${ARCHIVE_PATH}/',
  head,
  themeConfig: {
    ...theme,
    editLink: undefined,
    nav: [
      ...(theme.nav ?? []),
      { text: '${ARCHIVE_PATH} (archived)', items: [{ text: 'Latest docs', link: ${JSON.stringify(SITE)}, target: '_self' }] },
    ],
  },
} satisfies UserConfig<DefaultTheme.Config>
`,
  )
  // Only the docs package of the tag (VitePress and the theme's dependencies), from the tag's own lockfile.
  run('pnpm', ['install', '--frozen-lockfile', '--filter', '@anievo-id/rbac-evolution-docs'], work)
  run('pnpm', ['exec', 'vitepress', 'build'], join(work, 'docs'))
  const out = join(dist, ARCHIVE_PATH)
  rmSync(out, { recursive: true, force: true })
  cpSync(join(vp, 'dist'), out, { recursive: true })
  console.log(`Archived ${ARCHIVE_TAG} docs in ${out}`)
} finally {
  run('git', ['worktree', 'remove', '--force', work], root)
}

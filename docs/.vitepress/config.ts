import { existsSync, readFileSync } from 'node:fs'
import { type DefaultTheme, defineConfig, type MarkdownRenderer } from 'vitepress'

const repo = 'https://github.com/AniEvo-ID/rbac-evolution'
// The docs deploy on every push to main, so this is always the version that main (and npm) carries.
const { version } = JSON.parse(readFileSync(new URL('../../packages/core/package.json', import.meta.url), 'utf8'))

// One sidebar group per package, written by docs/scripts/api.mjs (`pnpm docs:api`, run by the
// docs `build` and `dev` scripts). Missing when VitePress is started on its own.
const apiSidebarFile = new URL('../api/sidebar.json', import.meta.url)
const apiSidebar: DefaultTheme.SidebarItem[] = existsSync(apiSidebarFile)
  ? JSON.parse(readFileSync(apiSidebarFile, 'utf8'))
  : []
// `/api/` lists the packages; each `/api/<dir>/` page only gets its own package's tree, so a page
// doesn't render the members of all 22 packages in its sidebar.
const apiPackages: DefaultTheme.SidebarItem = {
  text: 'API reference',
  items: [{ text: 'All packages', link: '/api/' }, ...apiSidebar.map(({ text, link }) => ({ text, link }))],
}
const apiSidebars: DefaultTheme.SidebarMulti = {
  '/api/': [apiPackages],
  ...Object.fromEntries(
    apiSidebar.map((pkg) => [
      pkg.link!,
      [{ text: 'API reference', items: [{ text: 'All packages', link: '/api/' }] }, { ...pkg, collapsed: false }],
    ]),
  ),
}

// ```mermaid fences become a <MermaidDiagram> (theme/components/MermaidDiagram.vue), which renders the SVG in the
// browser and loads `mermaid` only on the pages that have a diagram. The source is URI-encoded so it survives as a
// Vue attribute.
const mermaidFence = (md: MarkdownRenderer): void => {
  const fence = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!
    if (token.info.trim() !== 'mermaid') return fence(tokens, idx, options, env, self)
    return `<MermaidDiagram code="${encodeURIComponent(token.content)}" />\n`
  }
}

export default defineConfig({
  title: 'RBAC Evolution',
  description: 'Role & permission management (RBAC) for JavaScript & TypeScript — inspired by spatie/laravel-permission.',
  lang: 'en-US',
  // served from https://creation.anievo.id/rbac-evolution/
  base: '/rbac-evolution/',
  cleanUrls: true,
  // dark only: no light theme, no theme switch
  appearance: 'force-dark',
  lastUpdated: true,
  markdown: { config: mermaidFence },
  head: [
    ['meta', { name: 'theme-color', content: '#0a0c0e' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/rbac-evolution/brand/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/rbac-evolution/brand/apple-touch-icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'RBAC Evolution — roles & permissions, cultivated' }],
    ['meta', { property: 'og:image', content: 'https://creation.anievo.id/rbac-evolution/brand/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Changa+One&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Yellowtail&display=swap',
      },
    ],
  ],

  themeConfig: {
    logo: { src: '/brand/logo.webp', alt: 'RBAC Evolution' },
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Frameworks', link: '/frameworks/react' },
      { text: 'Adapters', link: '/adapters/overview' },
      { text: 'CLI', link: '/basic-usage/cli' },
      { text: 'API', link: '/api/' },
      { text: 'Test report', link: '/quality' },
      {
        text: `v${version}`,
        items: [
          { text: "What's new", link: '/guide/whats-new' },
          { text: `Release notes v${version}`, link: `${repo}/releases/tag/%40anievo-id%2Frbac-evolution%40${version}` },
          { text: 'Changelog', link: `${repo}/blob/main/packages/core/CHANGELOG.md` },
          { text: 'Releases', link: `${repo}/releases` },
          { text: 'npm', link: 'https://www.npmjs.com/package/@anievo-id/rbac-evolution' },
          { text: 'Contributing', link: `${repo}/blob/main/CONTRIBUTING.md` },
        ],
      },
      {
        // Version switcher. The 0.x docs are a separate, frozen build (docs/scripts/archive.mjs), so the link is a full
        // URL that leaves this site's router instead of a route of its own.
        text: 'Versions',
        items: [
          { text: `${version.split('.')[0]}.x (latest)`, link: '/guide/introduction' },
          { text: '0.x (archived)', link: 'https://creation.anievo.id/rbac-evolution/0.x/', target: '_self' },
        ],
      },
    ],

    sidebar: {
      ...apiSidebars,
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Runtimes (Node, Bun)', link: '/guide/runtimes' },
            { text: 'Quick start', link: '/guide/quick-start' },
            { text: 'Coming from Laravel', link: '/guide/coming-from-laravel' },
            { text: 'How it works', link: '/guide/how-it-works' },
            { text: 'Example apps', link: '/guide/examples' },
            { text: "What's new", link: '/guide/whats-new' },
            { text: 'Upgrading to 1.0', link: '/guide/upgrading' },
            { text: 'Versioning', link: '/guide/versioning' },
          ],
        },
        {
          text: 'Basic Usage',
          items: [
            { text: 'Basic usage', link: '/basic-usage/basic-usage' },
            { text: 'Direct permissions', link: '/basic-usage/direct-permissions' },
            { text: 'Permissions via roles', link: '/basic-usage/roles' },
            { text: 'Temporary access', link: '/basic-usage/temporary-access' },
            { text: 'Typed names (enums)', link: '/basic-usage/typed-names' },
            { text: 'Teams', link: '/basic-usage/teams' },
            { text: 'Wildcard permissions', link: '/basic-usage/wildcard-permissions' },
            { text: 'Super-admin', link: '/basic-usage/super-admin' },
            { text: 'Multiple guards', link: '/basic-usage/multiple-guards' },
            { text: 'CLI', link: '/basic-usage/cli' },
          ],
        },
        {
          text: 'Frameworks',
          items: [
            { text: 'React', link: '/frameworks/react' },
            { text: 'Next.js', link: '/frameworks/nextjs' },
            { text: 'React Router', link: '/frameworks/react-router' },
            { text: 'Vue', link: '/frameworks/vue' },
            { text: 'Nuxt', link: '/frameworks/nuxt' },
            { text: 'SvelteKit', link: '/frameworks/sveltekit' },
            { text: 'TanStack Start', link: '/frameworks/tanstack-start' },
            { text: 'Astro', link: '/frameworks/astro' },
            { text: 'Express', link: '/frameworks/express' },
            { text: 'Hono', link: '/frameworks/hono' },
            { text: 'Elysia', link: '/frameworks/elysia' },
            { text: 'Fastify', link: '/frameworks/fastify' },
            { text: 'NestJS', link: '/frameworks/nestjs' },
            { text: 'tRPC', link: '/frameworks/trpc' },
          ],
        },
        {
          text: 'Adapters',
          items: [
            { text: 'Overview', link: '/adapters/overview' },
            { text: 'Prisma', link: '/adapters/prisma' },
            { text: 'Drizzle', link: '/adapters/drizzle' },
            { text: 'Kysely', link: '/adapters/kysely' },
            { text: 'TypeORM', link: '/adapters/typeorm' },
            { text: 'Mongoose (MongoDB)', link: '/adapters/mongoose' },
            { text: 'Memory', link: '/adapters/memory' },
            { text: 'Custom adapter', link: '/adapters/custom' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Seeding (sync)', link: '/advanced/seeding' },
            { text: 'Cache', link: '/advanced/cache' },
            { text: 'Events', link: '/advanced/events' },
            { text: 'Querying subjects', link: '/advanced/querying-subjects' },
            { text: 'Errors', link: '/advanced/errors' },
            { text: 'Testing', link: '/advanced/testing' },
          ],
        },
        {
          text: 'Best Practices',
          items: [
            { text: 'Roles vs permissions', link: '/best-practices/roles-vs-permissions' },
            { text: 'Security', link: '/best-practices/security' },
            { text: 'Threat model', link: '/best-practices/threat-model' },
            { text: 'Production checklist', link: '/best-practices/production' },
          ],
        },
        {
          text: 'Use cases',
          items: [
            { text: 'Overview', link: '/use-cases/' },
            { text: 'Blog / CMS', link: '/use-cases/blog-cms' },
            { text: 'B2B SaaS with organizations', link: '/use-cases/saas-multi-tenant' },
            { text: 'E-commerce back office', link: '/use-cases/ecommerce-admin' },
            { text: 'Public API with API keys', link: '/use-cases/public-api' },
            { text: 'Internal admin panel', link: '/use-cases/internal-tools' },
          ],
        },
        {
          text: 'Recipes',
          items: [
            { text: 'Auth.js in Next.js', link: '/recipes/authjs' },
            { text: 'Multi-tenant SaaS', link: '/recipes/multi-tenant' },
            { text: 'Admin UI for roles', link: '/recipes/admin-ui' },
            { text: 'Audit log', link: '/recipes/audit-log' },
            { text: 'Koa', link: '/recipes/koa' },
          ],
        },
        {
          text: 'Reference',
          items: [{ text: 'API reference', link: '/api/' }],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License. Inspired by spatie/laravel-permission.',
      copyright: 'Copyright © 2026 AniEvo-ID',
    },
  },
})

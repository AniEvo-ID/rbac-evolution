import { defineConfig } from 'vitepress'

const repo = 'https://github.com/AniEvo-ID/rbac-evolution'

export default defineConfig({
  title: 'rbac-evolution',
  description: 'Role & permission management (RBAC) for JavaScript & TypeScript — inspired by spatie/laravel-permission.',
  lang: 'en-US',
  // served from https://anievo-id.github.io/rbac-evolution/
  base: '/rbac-evolution/',
  cleanUrls: true,
  // three.js is lazy-loaded on the home page only (~130 kB gzip)
  vite: { build: { chunkSizeWarningLimit: 600 } },
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#0b1020' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/rbac-evolution/brand/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/rbac-evolution/brand/apple-touch-icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'rbac-evolution — roles & permissions, cultivated' }],
    ['meta', { property: 'og:image', content: 'https://anievo-id.github.io/rbac-evolution/brand/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Serif+JP:wght@600;700&family=Space+Grotesk:wght@300;500;700&display=swap',
      },
    ],
  ],

  themeConfig: {
    logo: { light: '/brand/mark-light.svg', dark: '/brand/mark-dark.svg', alt: 'rbac-evolution' },
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Frameworks', link: '/frameworks/react' },
      { text: 'Adapters', link: '/adapters/overview' },
      { text: 'CLI', link: '/basic-usage/cli' },
      {
        text: 'Links',
        items: [
          { text: 'Changelog', link: `${repo}/blob/main/packages/core/CHANGELOG.md` },
          { text: 'Releases', link: `${repo}/releases` },
          { text: 'npm', link: 'https://www.npmjs.com/package/@anievo-id/rbac-evolution' },
          { text: 'Contributing', link: `${repo}/blob/main/CONTRIBUTING.md` },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Runtimes (Node, Bun)', link: '/guide/runtimes' },
          { text: 'Quick start', link: '/guide/quick-start' },
          { text: 'Coming from Laravel', link: '/guide/coming-from-laravel' },
          { text: 'Example apps', link: '/guide/examples' },
        ],
      },
      {
        text: 'Basic Usage',
        items: [
          { text: 'Basic usage', link: '/basic-usage/basic-usage' },
          { text: 'Direct permissions', link: '/basic-usage/direct-permissions' },
          { text: 'Permissions via roles', link: '/basic-usage/roles' },
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
          { text: 'Vue', link: '/frameworks/vue' },
          { text: 'Nuxt', link: '/frameworks/nuxt' },
          { text: 'Express', link: '/frameworks/express' },
          { text: 'Hono', link: '/frameworks/hono' },
          { text: 'Fastify', link: '/frameworks/fastify' },
          { text: 'NestJS', link: '/frameworks/nestjs' },
        ],
      },
      {
        text: 'Adapters',
        items: [
          { text: 'Overview', link: '/adapters/overview' },
          { text: 'Prisma', link: '/adapters/prisma' },
          { text: 'Drizzle', link: '/adapters/drizzle' },
          { text: 'Kysely', link: '/adapters/kysely' },
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
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License. Inspired by spatie/laravel-permission.',
      copyright: 'Copyright © 2026 AniEvo-ID',
    },
  },
})

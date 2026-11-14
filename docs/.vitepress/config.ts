import { defineConfig } from 'vitepress'

const repo = 'https://github.com/AniEvo-ID/rbac-evolution'

export default defineConfig({
  title: 'rbac-evolution',
  description: 'Role & permission management (RBAC) for JavaScript & TypeScript — inspired by spatie/laravel-permission.',
  lang: 'en-US',
  // served from https://anievo-id.github.io/rbac-evolution/
  base: '/rbac-evolution/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#7c3aed' }]],

  themeConfig: {
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

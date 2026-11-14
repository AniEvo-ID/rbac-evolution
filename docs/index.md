---
layout: home

hero:
  name: rbac-evolution
  text: Roles & permissions, cultivated.
  tagline: Everything you love about spatie/laravel-permission — for Node.js and Bun, every framework, every database.
  actions:
    - theme: brand
      text: Begin cultivation
      link: /guide/quick-start
    - theme: alt
      text: Read the guide
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/AniEvo-ID/rbac-evolution

features:
  - icon: { src: /mascots/sect-master.webp, alt: Yue the Sect Master }
    title: Framework-agnostic core
    details: assignRole, givePermissionTo, hasRole, can — the API you know from Laravel, fully typed with typed role and permission names.
    link: /basic-usage/basic-usage
    linkText: Basic usage
  - icon: { src: /mascots/weaver.webp, alt: Lan the Formation Weaver }
    title: Any database
    details: Prisma, Drizzle, Kysely and Mongoose adapters — PostgreSQL, MySQL, SQLite, SQL Server, MongoDB — or write your own.
    link: /adapters/overview
    linkText: Adapters
  - icon: { src: /mascots/gatekeeper.webp, alt: Rin the Blade Gatekeeper }
    title: Every framework
    details: "&lt;Can&gt;, useCan(), v-can, route guards, server action guards and middleware for React, Next.js, Vue, Nuxt, Express, Hono, Fastify and NestJS."
    link: /frameworks/react
    linkText: Frameworks
  - icon: { src: /mascots/twins.webp, alt: Hana and Sora the Branch Twins }
    title: Guards, teams & wildcards
    details: Separate web/api guards, multi-tenant teams and wildcard permissions like articles.*.
    link: /basic-usage/teams
    linkText: Teams
  - icon: { src: /mascots/messenger.webp, alt: Feng the Spirit Messenger }
    title: Super-admin, events & cache
    details: Gate::before-style hooks, superAdminRoles, events for audit logs and a pluggable cache.
    link: /advanced/events
    linkText: Events
  - icon: { src: /mascots/disciple.webp, alt: Tao the New Disciple }
    title: CLI & seeding
    details: create-role, assign-role, show and sync — the equivalent of php artisan permission:*, plus declarative seeding.
    link: /basic-usage/cli
    linkText: CLI
---

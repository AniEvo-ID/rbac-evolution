/** The "Sect of Evolution" cast — original characters for the RBAC Evolution docs. */
export interface Mascot {
  id: string
  name: string
  title: string
  /** What this character watches over in the docs. */
  role: string
  /** Docs page the character belongs to. */
  link: string
  /** A short line shown next to the character. */
  line: string
  /** Accent color for glows and badges. */
  accent: string
  /** Two or three sentences for the character select on the home page. */
  description: string
  /** What the "Learn …" button links to, e.g. `super-admin`. */
  topic: string
}

export const mascots: Mascot[] = [
  {
    id: 'sect-master',
    name: 'Yue',
    title: 'Sect Master',
    role: 'Super-admin',
    link: '/basic-usage/super-admin',
    line: 'The seal of the Sect Master opens every gate — use it sparingly.',
    accent: '#00c896',
    description:
      'Yue holds the one seal every gate obeys. Give a role to superAdminRoles, or decide in a before() hook, and every can() check says yes for that subject, across every guard and team.',
    topic: 'super-admin',
  },
  {
    id: 'gatekeeper',
    name: 'Rin',
    title: 'Blade Gatekeeper',
    role: 'Guards & middleware',
    link: '/frameworks/express',
    line: 'No permission, no passage. I check every request on the server.',
    accent: '#00c2e0',
    description:
      'Rin stands at every route. Middleware and guards for Express, Fastify, Hono, NestJS and Next.js answer 401 for guests and 403 for missing access, before your handler runs.',
    topic: 'guards',
  },
  {
    id: 'scroll-keeper',
    name: 'Mei',
    title: 'Scroll Keeper',
    role: 'Permissions',
    link: '/basic-usage/direct-permissions',
    line: 'Each scroll is one permission. Roles are just bundles of scrolls!',
    accent: '#a07bff',
    description:
      'Mei keeps the library of technique scrolls. Create permissions, give them straight to a user or bundle them into roles, and use wildcards like articles.* when one scroll should cover many.',
    topic: 'permissions',
  },
  {
    id: 'twins',
    name: 'Hana & Sora',
    title: 'Branch Twins',
    role: 'Teams',
    link: '/basic-usage/teams',
    line: 'Same sect, different branches — roles stay inside their team.',
    accent: '#ff5c74',
    description:
      'The twins guard the branches of the sect. Turn on teams and the same user can be an elder in the east branch and a plain disciple in the west: every role is scoped to its team.',
    topic: 'teams',
  },
  {
    id: 'disciple',
    name: 'Tao',
    title: 'New Disciple',
    role: 'Quick start',
    link: '/guide/quick-start',
    line: 'Lv.1 → first role assigned in five minutes. Let’s go!',
    accent: '#ff8a1f',
    description:
      'Tao just joined the sect. Follow the quick start: install the core, create a permission and a role, assign it, and check can(). All in memory, no database needed.',
    topic: 'the quick start',
  },
  {
    id: 'weaver',
    name: 'Lan',
    title: 'Formation Weaver',
    role: 'Database adapters',
    link: '/adapters/overview',
    line: 'Prisma, Drizzle, Kysely, Mongoose — I bind them all to the same five tables.',
    accent: '#ffc21a',
    description:
      'Lan weaves the formation that stores everything. Adapters for Prisma, Drizzle, Kysely and Mongoose keep the same five tables as spatie on PostgreSQL, MySQL, SQLite, SQL Server and MongoDB.',
    topic: 'adapters',
  },
  {
    id: 'alchemist',
    name: 'Xia',
    title: 'Pill Alchemist',
    role: 'Cache',
    link: '/advanced/cache',
    line: 'Refined once, served many times. Change a role and I brew a fresh batch.',
    accent: '#3ddc6e',
    description:
      'Xia brews every lookup once and serves it many times. The cache keeps can() fast and is cleared automatically on every change; plug in Redis or any store you like.',
    topic: 'the cache',
  },
  {
    id: 'messenger',
    name: 'Feng',
    title: 'Spirit Messenger',
    role: 'Events',
    link: '/advanced/events',
    line: 'role.attached! permission.detached! I announce every change.',
    accent: '#3d8bff',
    description:
      'Feng carries word of every change. Listen to role and permission events to write audit logs, sync another system or notify an admin.',
    topic: 'events',
  },
  {
    id: 'spirit-fox',
    name: 'Kitsu',
    title: 'Spirit Fox',
    role: 'Lost pages & hints',
    link: '/guide/introduction',
    line: 'Kyu? Lost your way? Follow my tails back home.',
    accent: '#d29bff',
    description:
      'Kitsu wanders the grounds and finds lost travellers. Whenever a page goes missing, the fox leads you back to the guide.',
    topic: 'the guide',
  },
]

export const byId = Object.fromEntries(mascots.map((m) => [m.id, m])) as Record<string, Mascot>

/** Which character guides which part of the docs (longest prefix wins). */
const routes: [prefix: string, id: string][] = [
  ['/guide/quick-start', 'disciple'],
  ['/guide/installation', 'disciple'],
  ['/guide/whats-new', 'messenger'],
  ['/guide/', 'scroll-keeper'],
  ['/basic-usage/super-admin', 'sect-master'],
  ['/basic-usage/teams', 'twins'],
  ['/basic-usage/multiple-guards', 'gatekeeper'],
  ['/basic-usage/cli', 'weaver'],
  ['/basic-usage/', 'scroll-keeper'],
  ['/frameworks/', 'gatekeeper'],
  ['/adapters/', 'weaver'],
  ['/advanced/cache', 'alchemist'],
  ['/advanced/events', 'messenger'],
  ['/advanced/seeding', 'sect-master'],
  ['/advanced/', 'weaver'],
  ['/best-practices/', 'gatekeeper'],
]

export function mascotForPath(path: string): Mascot {
  const clean = path.replace(/^\/rbac-evolution/, '').replace(/\.html$/, '')
  const hit = routes.find(([prefix]) => clean.startsWith(prefix))
  return byId[hit ? hit[1] : 'spirit-fox']!
}

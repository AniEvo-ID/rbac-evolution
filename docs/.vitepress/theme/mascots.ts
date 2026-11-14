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
  },
  {
    id: 'gatekeeper',
    name: 'Rin',
    title: 'Blade Gatekeeper',
    role: 'Guards & middleware',
    link: '/frameworks/express',
    line: 'No permission, no passage. I check every request on the server.',
    accent: '#00c2e0',
  },
  {
    id: 'scroll-keeper',
    name: 'Mei',
    title: 'Scroll Keeper',
    role: 'Permissions',
    link: '/basic-usage/direct-permissions',
    line: 'Each scroll is one permission. Roles are just bundles of scrolls!',
    accent: '#a07bff',
  },
  {
    id: 'twins',
    name: 'Hana & Sora',
    title: 'Branch Twins',
    role: 'Teams',
    link: '/basic-usage/teams',
    line: 'Same sect, different branches — roles stay inside their team.',
    accent: '#ff5c74',
  },
  {
    id: 'disciple',
    name: 'Tao',
    title: 'New Disciple',
    role: 'Quick start',
    link: '/guide/quick-start',
    line: 'Lv.1 → first role assigned in five minutes. Let’s go!',
    accent: '#ff8a1f',
  },
  {
    id: 'weaver',
    name: 'Lan',
    title: 'Formation Weaver',
    role: 'Database adapters',
    link: '/adapters/overview',
    line: 'Prisma, Drizzle, Kysely, Mongoose — I bind them all to the same five tables.',
    accent: '#ffc21a',
  },
  {
    id: 'alchemist',
    name: 'Xia',
    title: 'Pill Alchemist',
    role: 'Cache',
    link: '/advanced/cache',
    line: 'Refined once, served many times. Change a role and I brew a fresh batch.',
    accent: '#3ddc6e',
  },
  {
    id: 'messenger',
    name: 'Feng',
    title: 'Spirit Messenger',
    role: 'Events',
    link: '/advanced/events',
    line: 'role.attached! permission.detached! I announce every change.',
    accent: '#3d8bff',
  },
  {
    id: 'spirit-fox',
    name: 'Kitsu',
    title: 'Spirit Fox',
    role: 'Lost pages & hints',
    link: '/guide/introduction',
    line: 'Kyu? Lost your way? Follow my tails back home.',
    accent: '#d29bff',
  },
]

export const byId = Object.fromEntries(mascots.map((m) => [m.id, m])) as Record<string, Mascot>

/** Which character guides which part of the docs (longest prefix wins). */
const routes: [prefix: string, id: string][] = [
  ['/guide/quick-start', 'disciple'],
  ['/guide/installation', 'disciple'],
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

<script setup lang="ts">
import { withBase } from 'vitepress'
import { byId } from '../mascots'

// Tiny highlighter for the five snippets above, using the same colors as the docs' code blocks.
// shortcut: knows TS keywords/strings/calls and shell flags only; switch to shiki if snippets get richer.
const TS =
  /(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(const|let|await|async|import|from|export|new|return)\b|\b(true|false|null|\d+)\b|\b([A-Za-z_$][\w$]*)(?=\s*\()/gm
const SHELL = /("(?:[^"\\]|\\.)*")|(--[\w-]+)|^(npx|pnpm|bunx)\b|\b(rbac-evolution)\b/gm
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

function highlight(code: string, shell: boolean): string {
  const classes = shell ? ['s', 'n', 'k', 'f'] : ['c', 's', 'k', 'n', 'f']
  let out = ''
  let last = 0
  for (const m of code.matchAll(shell ? SHELL : TS)) {
    const group = m.slice(1).findIndex((g) => g !== undefined)
    out += esc(code.slice(last, m.index)) + `<span class="tk-${classes[group]}">${esc(m[0])}</span>`
    last = m.index! + m[0].length
  }
  return out + esc(code.slice(last))
}

const rows = [
  {
    no: '01',
    label: 'Roles & permissions',
    title: 'The API you know from Laravel',
    text: 'Create permissions, bundle them into roles, assign roles to users and ask can() anywhere. Fully typed, with typed role and permission names.',
    points: ['assignRole, givePermissionTo, hasRole, can', 'Wildcards like articles.*'],
    file: 'src/rbac.ts',
    code: `await rbac.role('writer').givePermissionTo('edit articles')
await rbac.for(user).assignRole('writer')

await rbac.for(user).can('edit articles')`,
    result: 'true',
    mascot: 'scroll-keeper',
    link: '/basic-usage/basic-usage',
  },
  {
    no: '02',
    label: 'Every framework',
    title: 'Guards for the stack you already run',
    text: 'Middleware and route guards for Express, Fastify, Hono, NestJS and Next.js, plus <Can>, useCan() and v-can for React, Vue and Nuxt.',
    points: ['401 for guests, 403 for missing access', 'Server checks first, UI helpers second'],
    file: 'src/server.ts',
    code: `app.use(rbacMiddleware({ rbac, getSubject }))

app.put('/articles/:id',
  requirePermission('articles.edit'),
  handler)`,
    result: '403 FORBIDDEN without the permission',
    mascot: 'gatekeeper',
    link: '/frameworks/express',
  },
  {
    no: '03',
    label: 'Any database',
    title: 'Bring your ORM, keep your tables',
    text: 'Prisma, Drizzle, Kysely and Mongoose adapters for PostgreSQL, MySQL, SQLite, SQL Server and MongoDB. Or write your own adapter in one file.',
    points: ['Same five tables as spatie', 'A shared contract test suite for custom adapters'],
    file: 'src/rbac.ts',
    code: `import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

export const rbac = createRbac({
  adapter: new PrismaAdapter(prisma),
})`,
    result: 'adapter ready',
    mascot: 'weaver',
    link: '/adapters/overview',
  },
  {
    no: '04',
    label: 'Teams & super-admin',
    title: 'Multi-tenant by design',
    text: 'Scope roles to a team, give one role every permission, and listen to every change for audit logs.',
    points: ['Same user, different roles per team', 'superAdminRoles and a before() hook'],
    file: 'src/rbac.ts',
    code: `const rbac = createRbac({
  adapter,
  teams: true,
  superAdminRoles: ['sect-master'],
})

await rbac.for(user, { team: 'east' }).assignRole('elder')
await rbac.for(user, { team: 'west' }).hasRole('elder')`,
    result: 'false',
    mascot: 'twins',
    link: '/basic-usage/teams',
  },
  {
    no: '05',
    label: 'CLI & seeding',
    title: 'php artisan permission, for Node',
    text: 'Create roles, assign them and inspect everything from the terminal, or sync a whole seed file in one command.',
    points: ['create-role, assign-role, show', 'sync with --dry-run before it writes'],
    file: 'terminal',
    code: `npx rbac-evolution create-role writer "edit articles"
npx rbac-evolution assign-role writer 1
npx rbac-evolution sync --dry-run`,
    result: 'plan printed, nothing written',
    mascot: 'disciple',
    link: '/basic-usage/cli',
  },
].map((r) => ({ ...r, guardian: byId[r.mascot]!, html: highlight(r.code, r.file === 'terminal') }))

</script>

<template>
  <section class="rows" aria-label="Features">
    <article v-for="(r, i) in rows" :key="r.no" class="row" :class="{ flip: i % 2 === 1 }" :style="{ '--accent': r.guardian.accent }">
      <div class="copy">
        <p class="label"><span class="no">{{ r.no }}</span>{{ r.label }}</p>
        <h2>{{ r.title }}</h2>
        <p class="text">{{ r.text }}</p>
        <ul class="points">
          <li v-for="p in r.points" :key="p">{{ p }}</li>
        </ul>
        <a class="more" :href="withBase(r.link)">Learn more →</a>
      </div>
      <figure class="panel">
        <figcaption class="chrome">
          <span class="dots" aria-hidden="true"><i /><i /><i /></span>
          <span class="file">{{ r.file }}</span>
        </figcaption>
        <pre><code v-html="r.html" /></pre>
        <p class="result"><span class="ok">→</span> {{ r.result }}</p>
        <img class="peek" :src="withBase(`/mascots/${r.mascot}.webp`)" alt="" width="90" height="120" loading="lazy" />
      </figure>
    </article>
  </section>

</template>

<style scoped>
.rows {
  max-width: 1152px;
  margin: 0 auto;
  padding: 40px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 88px;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 48px;
  align-items: center;
}
.row.flip .copy {
  order: 2;
}
.label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-family: var(--sect-font-label);
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sect-accent-text);
}
.no {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: rgba(37, 99, 235, 0.12);
}
h2 {
  margin: 0 0 12px;
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(28px, 3.6vw, 40px);
  line-height: 1.1;
  color: var(--vp-c-text-1);
}
.text {
  margin: 0 0 16px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.points {
  margin: 0 0 18px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.points li {
  display: flex;
  gap: 10px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.points li::before {
  content: '✓';
  color: var(--sect-jade);
  font-weight: 700;
}
.more {
  font-family: var(--sect-font-label);
  font-size: 15px;
  color: var(--sect-accent-text);
  text-decoration: none;
}
.more:hover {
  text-decoration: underline;
}
.panel {
  position: relative;
  margin: 0;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: #0d1014;
  box-shadow: 0 30px 80px -40px rgba(37, 99, 235, 0.55);
}
.chrome {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.dots {
  display: inline-flex;
  gap: 6px;
}
.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2b333d;
}
.dots i:first-child {
  background: var(--sect-signal);
}
pre {
  margin: 0;
  padding: 18px 18px 14px;
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.7;
}
code {
  font-family: var(--vp-font-family-mono);
  color: #e1e4e8;
}
code :deep(.tk-k) { color: #f97583; }
code :deep(.tk-s) { color: #9ecbff; }
code :deep(.tk-c) { color: #6a737d; }
code :deep(.tk-n) { color: #79b8ff; }
code :deep(.tk-f) { color: #b392f0; }
.result {
  margin: 0;
  padding: 10px 18px;
  border-top: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--sect-jade);
}
.ok {
  color: var(--sect-accent-text);
}
.peek {
  position: absolute;
  right: 14px;
  top: -78px;
  height: 92px;
  width: auto;
  pointer-events: none;
}
@media (max-width: 860px) {
  .row {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .row.flip .copy {
    order: 0;
  }
  .rows {
    gap: 64px;
  }
  .peek {
    height: 76px;
    top: -64px;
  }
}
</style>

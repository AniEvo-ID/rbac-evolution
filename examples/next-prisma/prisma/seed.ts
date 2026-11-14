// Seeds demo users, articles, roles and permissions. Run via `pnpm db:setup`
// (which first creates prisma/dev.db with `prisma db push`). Safe to run again:
// existing rows are kept. Delete prisma/dev.db to start from scratch.
import { PERMISSIONS, ROLES } from '../lib/permissions'
import { prisma } from '../lib/prisma'
import { rbac } from '../lib/rbac-engine'

const USERS = [
  { name: 'Alice Admin', email: 'alice@example.test', role: 'admin' },
  { name: 'Eddie Editor', email: 'eddie@example.test', role: 'editor' },
  { name: 'Vera Viewer', email: 'vera@example.test', role: 'viewer' },
  { name: 'Nora Nobody', email: 'nora@example.test', role: null },
] as const

async function main() {
  for (const permission of PERMISSIONS) await rbac.findOrCreatePermission(permission)

  for (const [role, permissions] of Object.entries(ROLES) as [keyof typeof ROLES, readonly (typeof PERMISSIONS)[number][]][]) {
    await rbac.findOrCreateRole(role)
    await rbac.role(role).syncPermissions([...permissions])
  }

  for (const { role, ...data } of USERS) {
    const user = await prisma.user.upsert({ where: { email: data.email }, update: {}, create: data })
    if (role) await rbac.for({ type: 'user', id: user.id }).assignRole(role)
  }

  if ((await prisma.article.count()) === 0) {
    const alice = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.test' } })
    const eddie = await prisma.user.findUniqueOrThrow({ where: { email: 'eddie@example.test' } })
    await prisma.article.createMany({
      data: [
        { title: 'Hello rbac-evolution', body: 'Roles and permissions for JS/TS, spatie-style.', published: true, authorId: alice.id },
        { title: 'Guards, wildcards and teams', body: 'Everything spatie/laravel-permission can do.', published: true, authorId: eddie.id },
        { title: 'Draft: server actions', body: 'withPermission() wraps a server action.', published: false, authorId: eddie.id },
      ],
    })
  }

  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  for (const user of users) {
    const roles = await rbac.for({ type: 'user', id: user.id }).getRoleNames()
    console.log(`  #${user.id} ${user.name.padEnd(13)} ${roles.join(', ') || '(no role)'}`)
  }
  console.log('Seeded prisma/dev.db')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

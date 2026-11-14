// Creates data/app.db (if needed) and seeds demo users, articles, roles and permissions.
// Safe to run again: existing rows are kept. Delete data/app.db to start from scratch.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { eq } from 'drizzle-orm'
import { client, db } from './db'
import { PERMISSIONS, ROLES, ROLE_NAMES, type RoleName, rbac } from './rbac'
import { APP_TABLES_SQL, articles, users } from './schema'

const USERS: { name: string; email: string; role: RoleName | null }[] = [
  { name: 'Alice Admin', email: 'alice@example.test', role: 'admin' },
  { name: 'Eddie Editor', email: 'eddie@example.test', role: 'editor' },
  { name: 'Vera Viewer', email: 'vera@example.test', role: 'viewer' },
  { name: 'Nora Nobody', email: 'nora@example.test', role: null },
]

async function main() {
  // Ready-made DDL shipped with the Drizzle adapter (CREATE ... IF NOT EXISTS).
  const require = createRequire(import.meta.url)
  const rbacSql = readFileSync(require.resolve('@anievo-id/rbac-evolution-drizzle/sql/sqlite.sql'), 'utf8')
  await client.executeMultiple(rbacSql)
  await client.executeMultiple(APP_TABLES_SQL)

  for (const permission of PERMISSIONS) await rbac.findOrCreatePermission(permission)
  for (const role of ROLE_NAMES) {
    await rbac.findOrCreateRole(role)
    await rbac.role(role).syncPermissions([...ROLES[role]])
  }

  for (const { role, ...data } of USERS) {
    await db.insert(users).values(data).onConflictDoNothing()
    const [user] = await db.select().from(users).where(eq(users.email, data.email))
    if (user && role) await rbac.for({ type: 'user', id: user.id }).assignRole(role)
  }

  if ((await db.select().from(articles).limit(1)).length === 0) {
    const all = await db.select().from(users)
    const idOf = (email: string) => all.find((u) => u.email === email)!.id
    await db.insert(articles).values([
      { title: 'Hello rbac-evolution', body: 'Roles and permissions for JS/TS, spatie-style.', published: true, authorId: idOf('alice@example.test') },
      { title: 'Express guards', body: 'requirePermission() and requireRole() as route middleware.', published: true, authorId: idOf('eddie@example.test') },
      { title: 'Draft: v-can', body: 'The Vue directive hides what you cannot do.', published: false, authorId: idOf('eddie@example.test') },
    ])
  }

  for (const user of await db.select().from(users).orderBy(users.id)) {
    const names = await rbac.for({ type: 'user', id: user.id }).getRoleNames()
    console.log(`  #${user.id} ${user.name.padEnd(13)} ${names.join(', ') || '(no role)'}`)
  }
  console.log('Seeded data/app.db')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.close())

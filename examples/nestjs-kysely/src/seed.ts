// Creates data/app.db (if needed) and seeds demo users, articles, roles and permissions.
// Safe to run again: existing rows are kept. Delete data/app.db to start from scratch.
import { createRbacTables } from '@anievo-id/rbac-evolution-kysely'
import { sql } from 'kysely'
import { DB_FILE, db } from './db'
import { PERMISSIONS, ROLES, ROLE_NAMES, type RoleName, rbac } from './rbac'

// The same users and roles as the other examples (docs: guide/examples).
const USERS: { name: string; email: string; role: RoleName | null }[] = [
  { name: 'Alice Admin', email: 'alice@example.test', role: 'admin' },
  { name: 'Eddie Editor', email: 'eddie@example.test', role: 'editor' },
  { name: 'Vera Viewer', email: 'vera@example.test', role: 'viewer' },
  { name: 'Nora Nobody', email: 'nora@example.test', role: null },
]

try {
  // The rbac-evolution tables (CREATE TABLE IF NOT EXISTS), then the app's own.
  await createRbacTables(db)
  await sql`CREATE TABLE IF NOT EXISTS users (
    id integer PRIMARY KEY AUTOINCREMENT,
    name text NOT NULL,
    email text NOT NULL UNIQUE
  )`.execute(db)
  await sql`CREATE TABLE IF NOT EXISTS articles (
    id integer PRIMARY KEY AUTOINCREMENT,
    title text NOT NULL,
    body text NOT NULL,
    published integer NOT NULL DEFAULT 0,
    author_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE
  )`.execute(db)

  for (const permission of PERMISSIONS) await rbac.findOrCreatePermission(permission)
  for (const role of ROLE_NAMES) {
    await rbac.findOrCreateRole(role)
    await rbac.role(role).syncPermissions([...ROLES[role]])
  }

  for (const { role, ...data } of USERS) {
    await db.insertInto('users').values(data).onConflict((oc) => oc.column('email').doNothing()).execute()
    const user = await db.selectFrom('users').select('id').where('email', '=', data.email).executeTakeFirstOrThrow()
    if (role) await rbac.for({ type: 'user', id: user.id }).assignRole(role)
  }

  if (!(await db.selectFrom('articles').select('id').limit(1).executeTakeFirst())) {
    const idOf = async (email: string) =>
      (await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow()).id
    const alice = await idOf('alice@example.test')
    const eddie = await idOf('eddie@example.test')
    await db
      .insertInto('articles')
      .values([
        { title: 'Hello rbac-evolution', body: 'Roles and permissions for JS/TS, spatie-style.', published: 1, author_id: alice },
        { title: 'NestJS guards', body: '@RequirePermissions() and @RequireRoles() on controllers.', published: 1, author_id: eddie },
        { title: 'Draft: Kysely adapter', body: 'One adapter for PostgreSQL, MySQL, SQLite and SQL Server.', published: 0, author_id: eddie },
      ])
      .execute()
  }

  for (const user of await db.selectFrom('users').select(['id', 'name']).orderBy('id').execute()) {
    const names = await rbac.for({ type: 'user', id: user.id }).getRoleNames()
    console.log(`  #${user.id} ${user.name.padEnd(12)} ${names.join(', ') || '(no role)'}`)
  }
  console.log(`Seeded ${DB_FILE}`)
} finally {
  await db.destroy()
}

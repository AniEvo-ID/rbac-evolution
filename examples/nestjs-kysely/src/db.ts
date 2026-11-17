import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { RbacDatabase } from '@anievo-id/rbac-evolution-kysely'
import { type Generated, Kysely } from 'kysely'

/** The app's own tables, next to the rbac-evolution ones in the same database. */
export interface AppDatabase {
  users: { id: Generated<number>; name: string; email: string }
  /** `published` is 0 or 1 (SQLite has no boolean). */
  articles: { id: Generated<number>; title: string; body: string; published: number; author_id: number }
}

export const DB_FILE = resolve(process.env['DB_FILE'] ?? 'data/app.db')
mkdirSync(dirname(DB_FILE), { recursive: true })

/** One Kysely instance for the app tables and for the rbac-evolution adapter. */
export const db = new Kysely<AppDatabase & RbacDatabase>({ dialect: new LibsqlDialect({ url: `file:${DB_FILE}` }) })

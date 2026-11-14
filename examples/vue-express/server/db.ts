import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// SQLite file in data/app.db (created by `pnpm db:setup`), resolved from the app folder.
const dataDir = join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

export const client = createClient({ url: process.env.DATABASE_URL ?? `file:${join(dataDir, 'app.db')}` })
export const db = drizzle(client, { schema })

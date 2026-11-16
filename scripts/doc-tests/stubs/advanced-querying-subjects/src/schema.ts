// The app's own Drizzle schema and client.
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
})

export const db = drizzle(process.env.DATABASE_URL!)
